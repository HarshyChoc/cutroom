import type { Edit, Segment } from "./schemas/edit";

// Pure functions over an Edit. Used by the validator, the caption builder,
// AND the Remotion composition (calculateMetadata + timeline layout), so the
// numbers always agree. No node imports — this is bundled into the renderer.

export const segmentOutputDurationMs = (segment: Segment): number =>
  Math.round((segment.sourceOutMs - segment.sourceInMs) / segment.speed);

export const outputDurationMs = (edit: Edit): number =>
  edit.segments.reduce((sum, seg) => sum + segmentOutputDurationMs(seg), 0);

export interface TimelineEntry {
  readonly segment: Segment;
  /** Where this segment starts on the OUTPUT timeline. */
  readonly outputStartMs: number;
  readonly outputDurationMs: number;
}

export const segmentTimeline = (edit: Edit): readonly TimelineEntry[] => {
  const entries: TimelineEntry[] = [];
  let cursor = 0;
  for (const segment of edit.segments) {
    const duration = segmentOutputDurationMs(segment);
    entries.push({ segment, outputStartMs: cursor, outputDurationMs: duration });
    cursor += duration;
  }
  return entries;
};

/**
 * Map a SOURCE-clock time to the OUTPUT clock. Returns null when the source
 * moment was cut. Boundary rule: a segment owns [sourceInMs, sourceOutMs).
 */
export const sourceToOutputMs = (
  edit: Edit,
  sourceMs: number,
): number | null => {
  for (const entry of segmentTimeline(edit)) {
    const { segment } = entry;
    if (sourceMs >= segment.sourceInMs && sourceMs < segment.sourceOutMs) {
      return (
        entry.outputStartMs +
        Math.round((sourceMs - segment.sourceInMs) / segment.speed)
      );
    }
  }
  return null;
};

/** Stable fingerprint of the cut list — used to detect caption desync. */
export const segmentsHash = (edit: Edit): string => {
  const parts = edit.segments.map(
    (s) => `${s.sourceInMs}:${s.sourceOutMs}:${s.speed}`,
  );
  // djb2 — tiny, deterministic, good enough for change detection.
  let hash = 5381;
  for (const ch of parts.join("|")) {
    hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16);
};
