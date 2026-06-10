import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { outputDurationMs, segmentTimeline } from "../../shared/edit-helpers";
import { editSchema, type Edit } from "../../shared/schemas/edit";
import { formatMs } from "../../shared/time";
import { EditorError } from "../lib/errors";
import { probeFile } from "../lib/ffmpeg";
import { readJsonFile, resolveVideoId, updateStatus } from "../lib/library";
import * as log from "../lib/log";
import { editPaths, outputPath } from "../lib/paths";
import { extractFrame } from "../lib/transcode";
import { emptyRenderRecord } from "../../shared/schemas/status";

// `editor verify` — mechanical checks on a render (duration, resolution)
// plus QC stills for Claude to actually LOOK at before calling it done.

const QC_FRAME_COUNT = 6;
const QC_FRAME_WIDTH = 540;
const DURATION_TOLERANCE_MS = 120;

export interface VerifyOptions {
  readonly edit: string;
}

/** Pick QC timestamps: hook start, caption moments, overlay midpoints, ending. */
const qcTimestamps = (edit: Edit, durationMs: number): readonly number[] => {
  const candidates: number[] = [Math.min(500, durationMs / 2)];
  for (const overlay of edit.overlays) {
    candidates.push((overlay.startMs + overlay.endMs) / 2);
  }
  const pages = edit.captions.pages;
  for (const fraction of [0.2, 0.45, 0.7]) {
    const page = pages[Math.floor(fraction * pages.length)];
    if (page) {
      candidates.push((page.startMs + page.endMs) / 2);
    }
  }
  const lastSegment = segmentTimeline(edit).at(-1);
  if (lastSegment) {
    candidates.push(lastSegment.outputStartMs + lastSegment.outputDurationMs / 2);
  }
  candidates.push(Math.max(0, durationMs - 600));

  const unique = [...new Set(candidates.map((t) => Math.round(Math.min(Math.max(t, 0), durationMs - 50))))];
  return unique.sort((a, b) => a - b).slice(0, QC_FRAME_COUNT);
};

export const runVerify = async (
  idOrPrefix: string,
  options: VerifyOptions,
): Promise<void> => {
  const videoId = await resolveVideoId(idOrPrefix);
  const targets = editPaths(videoId, options.edit);
  const edit = await readJsonFile(targets.edit, editSchema);

  const finalFile = outputPath(videoId, options.edit, false);
  const previewFile = outputPath(videoId, options.edit, true);
  const isPreviewOnly = !existsSync(finalFile);
  const file = isPreviewOnly ? previewFile : finalFile;
  if (!existsSync(file)) {
    throw new EditorError(
      `No render found for ${videoId} / ${options.edit}.`,
      `Run: npm run editor -- render ${videoId} --edit ${options.edit} --preview`,
    );
  }
  if (isPreviewOnly) {
    log.warn("Only a preview render exists — verifying that (final still needed).");
  }

  log.step(`Verifying ${path.basename(file)}`);
  const probe = await probeFile(file);
  const expectedMs = outputDurationMs(edit);
  const frameMs = 1000 / edit.output.fps;
  const tolerance = DURATION_TOLERANCE_MS + frameMs;
  const durationDelta = Math.abs(probe.durationMs - expectedMs);

  const problems: string[] = [];
  if (durationDelta > tolerance) {
    problems.push(
      `duration is ${formatMs(probe.durationMs)} (${probe.durationMs}ms) but the edit computes to ${expectedMs}ms (off by ${durationDelta}ms)`,
    );
  } else {
    log.ok(`duration ${probe.durationMs}ms ≈ expected ${expectedMs}ms`);
  }

  const expectedWidth = Math.round(edit.output.width * (isPreviewOnly ? 0.5 : 1));
  const expectedHeight = Math.round(edit.output.height * (isPreviewOnly ? 0.5 : 1));
  if (probe.width !== expectedWidth || probe.height !== expectedHeight) {
    problems.push(
      `resolution is ${probe.width}x${probe.height}, expected ${expectedWidth}x${expectedHeight}`,
    );
  } else {
    log.ok(`resolution ${probe.width}x${probe.height}`);
  }
  if (probe.audio === null && edit.source.relPath.length > 0) {
    log.warn("render has no audio track");
  }

  await rm(targets.qcDir, { recursive: true, force: true });
  await mkdir(targets.qcDir, { recursive: true });
  const stamps = qcTimestamps(edit, probe.durationMs);
  for (const [i, tMs] of stamps.entries()) {
    await extractFrame(
      file,
      path.join(targets.qcDir, `qc-${String(i + 1).padStart(2, "0")}-at-${tMs}ms.jpg`),
      tMs,
      QC_FRAME_WIDTH,
    );
  }
  log.ok(`${stamps.length} QC stills → ${path.relative(process.cwd(), targets.qcDir)}/`);
  log.hint("READ each QC still and check: captions legible + on screen, framing correct, overlays timed right.");

  if (problems.length > 0) {
    for (const p of problems) {
      log.fail(p);
    }
    throw new EditorError("Verification failed.", "Fix the edit or re-render, then verify again.");
  }

  if (!isPreviewOnly) {
    await updateStatus(videoId, (s) => {
      const record = s.renders[options.edit] ?? emptyRenderRecord();
      return {
        ...s,
        renders: {
          ...s.renders,
          [options.edit]: { ...record, verifiedAt: new Date().toISOString() },
        },
      };
    });
  }
  log.ok("mechanical checks passed");
};
