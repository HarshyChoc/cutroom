import {
  CAPTION_HOLD_MS,
  CAPTION_MAX_PAGE_DURATION_MS,
  CAPTION_MIN_TOKEN_MS,
  CAPTION_PAGE_GAP_MS,
} from "./constants";
import { segmentTimeline, sourceIdForSegment } from "./edit-helpers";
import type { CaptionPage, CaptionToken, Edit } from "./schemas/edit";
import type { TranscriptWord } from "./schemas/transcript";

// Deterministic transcript → karaoke caption pages. Pure so the validator,
// the captions command, and tests all agree. Steps:
//   1. merge punctuation-only tokens into the preceding word
//   2. keep words whose midpoint survives the cut, remapped to OUTPUT time
//   3. paginate by word count, silence gaps, duration, and segment boundaries

const PUNCTUATION_ONLY = /^[\s.,!?;:'"“”‘’…\-–—]+$/u;

const mergePunctuation = (
  words: readonly TranscriptWord[],
): readonly TranscriptWord[] => {
  const merged: TranscriptWord[] = [];
  for (const word of words) {
    const prev = merged[merged.length - 1];
    if (prev && PUNCTUATION_ONLY.test(word.text)) {
      merged[merged.length - 1] = {
        ...prev,
        text: prev.text + word.text.trimEnd(),
        endMs: Math.max(prev.endMs, word.endMs),
      };
    } else if (!PUNCTUATION_ONLY.test(word.text)) {
      merged.push(word);
    }
  }
  return merged;
};

interface PlacedToken {
  readonly token: CaptionToken;
  readonly segmentIndex: number;
}

const placeWords = (
  words: readonly TranscriptWord[],
  edit: Edit,
): readonly PlacedToken[] => {
  const timeline = segmentTimeline(edit);
  const placed: PlacedToken[] = [];
  for (const [segmentIndex, entry] of timeline.entries()) {
    const { segment } = entry;
    const segmentSourceId = sourceIdForSegment(edit, segment);
    for (const word of words) {
      if (
        word.sourceId !== undefined &&
        segmentSourceId !== null &&
        word.sourceId !== segmentSourceId
      ) {
        continue;
      }
      const midMs = (word.startMs + word.endMs) / 2;
      if (midMs < segment.sourceInMs || midMs >= segment.sourceOutMs) {
        continue; // word was cut from this segment
      }
      const clamp = (ms: number): number =>
        Math.min(Math.max(ms, segment.sourceInMs), segment.sourceOutMs - 1);
      const toOutput = (sourceMs: number): number =>
        entry.outputStartMs +
        Math.round((clamp(sourceMs) - segment.sourceInMs) / segment.speed);
      const fromMs = toOutput(word.startMs);
      const toMs = Math.max(toOutput(word.endMs), fromMs + CAPTION_MIN_TOKEN_MS);
      placed.push({
        token: { text: word.text, fromMs, toMs },
        segmentIndex,
      });
    }
  }
  return placed;
};

export const buildCaptionPages = (
  words: readonly TranscriptWord[],
  edit: Edit,
): readonly CaptionPage[] => {
  const maxWords = edit.captions.style.maxWordsPerPage;
  const placed = placeWords(mergePunctuation(words), edit);

  const pages: CaptionPage[] = [];
  let current: PlacedToken[] = [];

  const flush = (): void => {
    const first = current[0];
    const last = current[current.length - 1];
    if (!first || !last) {
      return;
    }
    pages.push({
      startMs: first.token.fromMs,
      endMs: last.token.toMs,
      tokens: current.map((p) => p.token),
    });
    current = [];
  };

  for (const item of placed) {
    const prev = current[current.length - 1];
    const first = current[0];
    const shouldBreak =
      prev !== undefined &&
      first !== undefined &&
      (current.length >= maxWords ||
        item.segmentIndex !== prev.segmentIndex ||
        item.token.fromMs - prev.token.toMs > CAPTION_PAGE_GAP_MS ||
        item.token.toMs - first.token.fromMs > CAPTION_MAX_PAGE_DURATION_MS);
    if (shouldBreak) {
      flush();
    }
    current.push(item);
  }
  flush();

  // Hold each page on screen briefly past its last word, without overlapping
  // the next page (returns new objects — never mutates).
  return pages.map((page, i) => {
    const next = pages[i + 1];
    const holdUntil = page.endMs + CAPTION_HOLD_MS;
    return {
      ...page,
      endMs: next ? Math.min(holdUntil, next.startMs) : holdUntil,
    };
  });
};
