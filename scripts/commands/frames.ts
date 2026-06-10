import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { framesIndexSchema, type FramesIndex } from "../../shared/schemas/frames";
import { stampStep } from "../../shared/schemas/status";
import { loadConfig } from "../lib/config";
import { EditorError } from "../lib/errors";
import {
  readProbe,
  resolveVideoId,
  updateStatus,
  writeJsonFile,
} from "../lib/library";
import * as log from "../lib/log";
import { videoPaths } from "../lib/paths";
import { extractFrame } from "../lib/transcode";

const FRAME_WIDTH = 640;

export interface FramesOptions {
  readonly count?: number;
  readonly force?: boolean;
}

/** Core frame sampling, reused by `editor analyze`. */
export const sampleFrames = async (
  videoId: string,
  options: FramesOptions,
): Promise<FramesIndex> => {
  const paths = videoPaths(videoId);
  const config = await loadConfig();
  const probe = await readProbe(videoId);
  const count = options.count ?? config.framesPerVideo;

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new EditorError(`Invalid frame count: ${count} (use 1-100).`);
  }
  if (!existsSync(paths.mezzanine)) {
    throw new EditorError(
      `No mezzanine for ${videoId}.`,
      `Run: npm run editor -- analyze ${videoId}`,
    );
  }

  await rm(paths.framesDir, { recursive: true, force: true });
  await mkdir(paths.framesDir, { recursive: true });

  // Sample mid-bucket so first/last frames avoid black lead-in/outs.
  const frames: { file: string; tMs: number }[] = [];
  for (let i = 0; i < count; i++) {
    const tMs = Math.round(((i + 0.5) / count) * probe.durationMs);
    const file = `frame-${String(i + 1).padStart(3, "0")}.jpg`;
    await extractFrame(
      paths.mezzanine,
      path.join(paths.framesDir, file),
      tMs,
      FRAME_WIDTH,
    );
    frames.push({ file, tMs });
  }

  const index: FramesIndex = {
    version: 1,
    videoId,
    frames,
    generatedAt: new Date().toISOString(),
  };
  await writeJsonFile(paths.framesIndex, framesIndexSchema, index);
  return index;
};

export const runFrames = async (
  idOrPrefix: string,
  options: FramesOptions,
): Promise<void> => {
  const videoId = await resolveVideoId(idOrPrefix);
  const paths = videoPaths(videoId);

  if (existsSync(paths.framesIndex) && !options.force) {
    log.warn(`${videoId} already has frames — use --force to resample.`);
    return;
  }

  log.step(`Sampling frames from ${videoId}`);
  const index = await sampleFrames(videoId, options);
  await updateStatus(videoId, (s) => stampStep(s, "frames"));
  log.ok(`${index.frames.length} frames → ${paths.framesDir}/`);
};
