import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { probeSchema } from "../../shared/schemas/probe";
import { stampStep, type StepName, type Status } from "../../shared/schemas/status";
import { EditorError } from "../lib/errors";
import { probeFile } from "../lib/ffmpeg";
import {
  listVideoIds,
  readProbe,
  readStatus,
  resolveVideoId,
  updateStatus,
  writeJsonFile,
} from "../lib/library";
import * as log from "../lib/log";
import { videoPaths } from "../lib/paths";
import {
  extractWhisperAudio,
  makeMezzanine,
  makeProxy,
} from "../lib/transcode";
import { sampleFrames } from "./frames";
import { transcribeVideo } from "./transcribe";

// `editor analyze` — the slow batch step. Each sub-step is independently
// resumable: it checks status.json + file existence before doing work, so
// re-running after a crash continues where it left off.

export interface AnalyzeOptions {
  readonly all?: boolean;
  readonly force?: boolean;
  readonly skipTranscribe?: boolean;
}

const findSource = (videoId: string): string => {
  const dir = videoPaths(videoId).dir;
  const candidates = [".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".m2ts"]
    .map((ext) => path.join(dir, `source${ext}`))
    .filter((p) => existsSync(p));
  const source = candidates[0];
  if (!source) {
    throw new EditorError(
      `Source file is missing for ${videoId}.`,
      "The original video was moved or deleted. Re-ingest it into content/raw/.",
    );
  }
  return source;
};

const needsStep = (
  status: Status,
  step: StepName,
  artifactPath: string,
  force: boolean,
): boolean => force || status.steps[step] === null || !existsSync(artifactPath);

const analyzeOne = async (
  videoId: string,
  force: boolean,
  skipTranscribe: boolean,
): Promise<void> => {
  const paths = videoPaths(videoId);
  const probe = await readProbe(videoId);
  let status = await readStatus(videoId);
  await mkdir(paths.mediaDir, { recursive: true });

  if (needsStep(status, "mezzanine", paths.mezzanine, force)) {
    log.info("creating mezzanine (normalized render source)…");
    const source = findSource(videoId);
    await makeMezzanine(source, paths.mezzanine, probe);
    // Re-probe the mezzanine: ITS duration/dims are what edits validate against.
    const mezzProbe = await probeFile(paths.mezzanine);
    await writeJsonFile(paths.mezzanineProbe, probeSchema, mezzProbe);
    status = await updateStatus(videoId, (s) => stampStep(s, "mezzanine"));
    log.ok(`mezzanine ready (${mezzProbe.width}x${mezzProbe.height} @ ${mezzProbe.fps}fps)`);
  } else {
    log.ok("mezzanine already done");
  }

  if (needsStep(status, "proxy", paths.proxy, force)) {
    log.info("creating preview proxy…");
    await makeProxy(paths.mezzanine, paths.proxy, probe.audio !== null);
    status = await updateStatus(videoId, (s) => stampStep(s, "proxy"));
    log.ok("proxy ready");
  } else {
    log.ok("proxy already done");
  }

  if (probe.audio === null) {
    log.warn("no audio track — skipping audio extraction");
    if (status.steps.audio === null) {
      status = await updateStatus(videoId, (s) => stampStep(s, "audio"));
    }
  } else if (needsStep(status, "audio", paths.audio, force)) {
    log.info("extracting speech audio for whisper…");
    await extractWhisperAudio(paths.mezzanine, paths.audio);
    status = await updateStatus(videoId, (s) => stampStep(s, "audio"));
    log.ok("audio extracted");
  } else {
    log.ok("audio already done");
  }

  if (skipTranscribe) {
    log.warn("skipping transcription by request");
  } else if (needsStep(status, "transcribed", paths.transcript, force)) {
    const transcript = await transcribeVideo(videoId, { force });
    status = await updateStatus(videoId, (s) => stampStep(s, "transcribed"));
    log.ok(`transcript ready (${transcript.words.length} words)`);
  } else {
    log.ok("transcript already done");
  }

  if (needsStep(status, "frames", paths.framesIndex, force)) {
    log.info("sampling frames…");
    const index = await sampleFrames(videoId, { force });
    status = await updateStatus(videoId, (s) => stampStep(s, "frames"));
    log.ok(`${index.frames.length} frames sampled`);
  } else {
    log.ok("frames already done");
  }
};

const isFullyAnalyzed = (status: Status): boolean =>
  status.steps.mezzanine !== null &&
  status.steps.transcribed !== null &&
  status.steps.frames !== null;

export const runAnalyze = async (
  idOrPrefix: string | undefined,
  options: AnalyzeOptions,
): Promise<void> => {
  let ids: readonly string[];
  if (options.all) {
    const all = await listVideoIds();
    const pending: string[] = [];
    for (const id of all) {
      const status = await readStatus(id).catch(() => null);
      if (status && (options.force || !isFullyAnalyzed(status))) {
        pending.push(id);
      }
    }
    ids = pending;
    if (ids.length === 0) {
      log.ok("Everything is already analyzed.");
      return;
    }
  } else if (idOrPrefix) {
    ids = [await resolveVideoId(idOrPrefix)];
  } else {
    throw new EditorError(
      "Specify a video id or use --all.",
      "Run `npm run editor -- status` to list videos.",
    );
  }

  const failures: { videoId: string; message: string }[] = [];
  for (const videoId of ids) {
    log.step(`Analyzing ${videoId}`);
    try {
      await analyzeOne(
        videoId,
        options.force ?? false,
        options.skipTranscribe ?? false,
      );
      await updateStatus(videoId, (s) => ({ ...s, lastError: null }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ videoId, message });
      log.fail(`${videoId}: ${message}`);
      await updateStatus(videoId, (s) => ({
        ...s,
        lastError: { step: "analyze", message, at: new Date().toISOString() },
      })).catch(() => undefined);
    }
  }

  log.step("Analyze summary");
  log.info(`${ids.length - failures.length} succeeded, ${failures.length} failed`);
  if (failures.length === 0) {
    log.hint("Next: classify each video (see CLAUDE.md), then editor plan-init <id>");
  } else {
    process.exitCode = 1;
  }
};
