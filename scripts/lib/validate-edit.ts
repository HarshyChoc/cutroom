import { existsSync } from "node:fs";
import path from "node:path";
import { outputDurationMs, segmentOutputDurationMs, segmentsHash } from "../../shared/edit-helpers";
import type { Edit } from "../../shared/schemas/edit";
import { CONTENT_DIR } from "./paths";

// Sanity checks beyond the zod schema — cross-field rules with messages
// written for the model that has to fix them. Shared by `editor validate`
// and `editor render` (render refuses on errors).

export interface ValidationIssue {
  readonly level: "error" | "warning";
  readonly where: string;
  readonly message: string;
}

export const validateEdit = (edit: Edit): readonly ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const error = (where: string, message: string): void => {
    issues.push({ level: "error", where, message });
  };
  const warning = (where: string, message: string): void => {
    issues.push({ level: "warning", where, message });
  };

  const sourceAbs = path.join(CONTENT_DIR, edit.source.relPath);
  if (!existsSync(sourceAbs)) {
    error("source.relPath", `file not found: ${edit.source.relPath} — run editor analyze first?`);
  }

  const totalMs = outputDurationMs(edit);

  edit.segments.forEach((seg, i) => {
    const where = `segments[${i}] (${seg.id})`;
    if (seg.sourceOutMs > edit.source.durationMs) {
      error(where, `sourceOutMs ${seg.sourceOutMs} exceeds source duration ${edit.source.durationMs}`);
    }
    if (seg.transitionAfter === "fade") {
      warning(where, "transitionAfter \"fade\" is not implemented yet — it will render as a hard cut");
    }
    const segDur = segmentOutputDurationMs(seg);
    if (segDur < 100) {
      warning(where, `very short segment (${segDur}ms) — intentional?`);
    }
    if (seg.transform) {
      const kfs = seg.transform.keyframes;
      kfs.forEach((kf, k) => {
        if (k > 0 && kf.tMs <= (kfs[k - 1]?.tMs ?? 0)) {
          error(`${where}.transform.keyframes[${k}]`, "keyframes must have strictly increasing tMs");
        }
        if (kf.tMs > segDur) {
          warning(`${where}.transform.keyframes[${k}]`, `tMs ${kf.tMs} is past the segment's output duration ${segDur}`);
        }
      });
    }
  });

  const dupIds = edit.segments
    .map((s) => s.id)
    .filter((id, i, all) => all.indexOf(id) !== i);
  if (dupIds.length > 0) {
    error("segments", `duplicate segment ids: ${[...new Set(dupIds)].join(", ")}`);
  }

  edit.captions.pages.forEach((page, i) => {
    const where = `captions.pages[${i}]`;
    if (page.endMs <= page.startMs) {
      error(where, "endMs must be greater than startMs");
    }
    if (page.endMs > totalMs + 1000) {
      error(where, `page ends at ${page.endMs} but the video is only ${totalMs}ms long — re-run: editor captions`);
    }
    const next = edit.captions.pages[i + 1];
    if (next && next.startMs < page.endMs) {
      error(where, `overlaps the next page (ends ${page.endMs}, next starts ${next.startMs})`);
    }
  });

  if (
    edit.captions.enabled &&
    edit.captions.pages.length > 0 &&
    edit.captions.builtFromSegmentsHash !== undefined &&
    edit.captions.builtFromSegmentsHash !== segmentsHash(edit)
  ) {
    warning(
      "captions",
      "segments changed after captions were built — timings are stale. Re-run: editor captions",
    );
  }
  if (edit.captions.enabled && edit.captions.pages.length === 0) {
    warning("captions", "captions are enabled but there are no pages — run: editor captions");
  }

  edit.overlays.forEach((ov, i) => {
    const where = `overlays[${i}]`;
    if (ov.endMs <= ov.startMs) {
      error(where, "endMs must be greater than startMs");
    }
    if (ov.startMs > totalMs) {
      error(where, `starts at ${ov.startMs} but the video is only ${totalMs}ms long`);
    }
  });

  if (edit.music) {
    const musicAbs = path.join(CONTENT_DIR, edit.music.src);
    if (!existsSync(musicAbs)) {
      error("music.src", `file not found: ${edit.music.src} (looked in content/)`);
    }
  }

  return issues;
};
