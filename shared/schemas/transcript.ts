import { z } from "zod";
import { TRANSCRIPT_VERSION } from "../constants";

// Normalized word-level transcript, independent of which STT engine produced
// it. Times are SOURCE-clock milliseconds. Word text keeps its leading space
// where present (whisper convention) so words can be joined directly.

export const transcriptWordSchema = z.object({
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type TranscriptWord = z.infer<typeof transcriptWordSchema>;

export const transcriptSchema = z.object({
  version: z.literal(TRANSCRIPT_VERSION),
  videoId: z.string().min(1),
  language: z.string(),
  model: z.string(),
  text: z.string(),
  words: z.array(transcriptWordSchema),
  generatedAt: z.string(),
});

export type Transcript = z.infer<typeof transcriptSchema>;
