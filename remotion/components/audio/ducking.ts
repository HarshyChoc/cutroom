import type { CaptionPage, Edit } from "../../../shared/schemas/edit";

// Pure music-ducking math. The speech map is derived from caption pages —
// no audio analysis needed: where there are caption tokens, someone is
// talking, so the music dips.

export interface SpeechInterval {
  readonly startMs: number;
  readonly endMs: number;
}

const MERGE_GAP_MS = 250;

/** Merge caption pages into speech intervals, bridging tiny gaps. */
export const speechIntervals = (
  pages: readonly CaptionPage[],
): readonly SpeechInterval[] => {
  const merged: SpeechInterval[] = [];
  for (const page of pages) {
    const prev = merged[merged.length - 1];
    if (prev && page.startMs - prev.endMs <= MERGE_GAP_MS) {
      merged[merged.length - 1] = { ...prev, endMs: Math.max(prev.endMs, page.endMs) };
    } else {
      merged.push({ startMs: page.startMs, endMs: page.endMs });
    }
  }
  return merged;
};

type Ducking = NonNullable<Edit["music"]>["ducking"];

/**
 * Music volume at output time tMs: full `base` in silence, `duckedVolume`
 * under speech, with linear attack/release ramps at the edges.
 */
export const duckedMusicVolume = (
  tMs: number,
  base: number,
  intervals: readonly SpeechInterval[],
  ducking: Ducking,
): number => {
  if (!ducking.enabled || intervals.length === 0 || base <= 0) {
    return base;
  }
  const ducked = Math.min(ducking.duckedVolume, base);
  let volume = base;
  for (const interval of intervals) {
    if (tMs >= interval.startMs && tMs < interval.endMs) {
      return ducked;
    }
    if (ducking.attackMs > 0 && tMs >= interval.startMs - ducking.attackMs && tMs < interval.startMs) {
      const progress = (tMs - (interval.startMs - ducking.attackMs)) / ducking.attackMs;
      volume = Math.min(volume, base + (ducked - base) * progress);
    }
    if (ducking.releaseMs > 0 && tMs >= interval.endMs && tMs < interval.endMs + ducking.releaseMs) {
      const progress = (tMs - interval.endMs) / ducking.releaseMs;
      volume = Math.min(volume, ducked + (base - ducked) * progress);
    }
  }
  return volume;
};
