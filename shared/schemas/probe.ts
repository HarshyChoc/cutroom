import { z } from "zod";
import { PROBE_VERSION } from "../constants";

// Normalized ffprobe result for a source video. width/height are DISPLAY
// dimensions (rotation metadata already applied), so 9:16 phone footage
// reports portrait dims even when the raw stream is landscape + rotate tag.

export const probeSchema = z.object({
  version: z.literal(PROBE_VERSION),
  durationMs: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  codec: z.string(),
  pixFmt: z.string().nullable(),
  rotation: z.number().int(),
  isVfr: z.boolean(),
  isHdr: z.boolean(),
  audio: z
    .object({
      codec: z.string(),
      sampleRate: z.number().int().positive(),
      channels: z.number().int().positive(),
    })
    .nullable(),
  sizeBytes: z.number().int().nonnegative(),
});

export type Probe = z.infer<typeof probeSchema>;
