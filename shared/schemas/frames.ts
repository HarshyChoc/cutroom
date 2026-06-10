import { z } from "zod";

// Index of sampled stills (content/library/<id>/frames/index.json). Claude
// reads the jpgs listed here to visually classify the content.

export const framesIndexSchema = z.object({
  version: z.literal(1),
  videoId: z.string().min(1),
  frames: z.array(
    z.object({
      file: z.string().min(1),
      tMs: z.number().int().nonnegative(),
    }),
  ),
  generatedAt: z.string(),
});

export type FramesIndex = z.infer<typeof framesIndexSchema>;
