import { copyFile, mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { VIDEO_EXTENSIONS } from "../../shared/constants";
import { probeSchema } from "../../shared/schemas/probe";
import { createStatus, statusSchema } from "../../shared/schemas/status";
import { EditorError } from "../lib/errors";
import { probeFile } from "../lib/ffmpeg";
import { makeVideoId } from "../lib/ids";
import { writeJsonFile } from "../lib/library";
import * as log from "../lib/log";
import { RAW_DIR, videoDir, videoPaths } from "../lib/paths";
import { formatMs } from "../../shared/time";

export interface IngestOptions {
  readonly copy?: boolean;
  readonly move?: boolean;
  readonly file?: string;
}

interface IngestResult {
  readonly videoId: string;
  readonly originalFilename: string;
  readonly skipped: boolean;
}

const isVideoFile = (name: string): boolean =>
  (VIDEO_EXTENSIONS as readonly string[]).includes(path.extname(name).toLowerCase());

const moveFile = async (from: string, to: string): Promise<void> => {
  try {
    await rename(from, to);
  } catch {
    // Cross-device fallback (e.g. external drive → internal disk).
    await copyFile(from, to);
    await unlink(from);
  }
};

const ingestOne = async (
  filePath: string,
  options: IngestOptions,
): Promise<IngestResult> => {
  const originalFilename = path.basename(filePath);
  const fileStat = await stat(filePath);
  const videoId = makeVideoId({
    filename: originalFilename,
    sizeBytes: fileStat.size,
    mtimeMs: fileStat.mtimeMs,
  });

  if (existsSync(videoDir(videoId))) {
    return { videoId, originalFilename, skipped: true };
  }

  // Probe BEFORE creating the workspace so a non-video never leaves a husk.
  const probe = await probeFile(filePath);
  const paths = videoPaths(videoId);
  await mkdir(paths.dir, { recursive: true });

  const ext = path.extname(originalFilename).toLowerCase();
  const sourceDest = path.join(paths.dir, `source${ext}`);
  if (!options.move) {
    await copyFile(filePath, sourceDest);
  } else {
    await moveFile(filePath, sourceDest);
  }

  await writeJsonFile(paths.probe, probeSchema, probe);
  await writeJsonFile(
    paths.status,
    statusSchema,
    createStatus({ videoId, originalFilename }),
  );

  log.ok(
    `${originalFilename} → ${videoId} (${formatMs(probe.durationMs)}, ${probe.width}x${probe.height}${probe.isHdr ? ", HDR" : ""}${probe.isVfr ? ", VFR" : ""})`,
  );
  return { videoId, originalFilename, skipped: false };
};

export const runIngest = async (options: IngestOptions): Promise<void> => {
  if (options.copy && options.move) throw new EditorError("Choose --copy or --move, not both.");
  let files: string[];
  if (options.file) {
    if (!existsSync(options.file)) {
      throw new EditorError(`File not found: ${options.file}`);
    }
    files = [path.resolve(options.file)];
  } else {
    const entries = await readdir(RAW_DIR).catch(() => [] as string[]);
    files = entries
      .filter((name) => !name.startsWith(".") && isVideoFile(name))
      .map((name) => path.join(RAW_DIR, name));
  }

  if (files.length === 0) {
    log.warn("Nothing to ingest.");
    log.hint(`Drop video files (${VIDEO_EXTENSIONS.join(" ")}) into content/raw/ first.`);
    return;
  }

  log.step(`Ingesting ${files.length} file${files.length === 1 ? "" : "s"}`);
  const results: IngestResult[] = [];
  const failures: { file: string; message: string }[] = [];
  for (const file of files) {
    try {
      results.push(await ingestOne(file, options));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ file: path.basename(file), message });
      log.fail(`${path.basename(file)}: ${message}`);
    }
  }

  const ingested = results.filter((r) => !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  log.step("Ingest summary");
  log.info(`${ingested.length} ingested, ${skipped.length} already in library, ${failures.length} failed`);
  for (const r of skipped) {
    log.warn(`${r.originalFilename} was already ingested as ${r.videoId} — left in place.`);
  }
  if (ingested.length > 0) {
    log.hint("Next: npm run editor -- analyze --all");
  }
  if (failures.length > 0) {
    process.exitCode = 1;
  }
};
