import { z } from "zod";
import { STATUS_VERSION } from "../constants";

// Per-video pipeline state. Lives at content/library/<id>/status.json and is
// the source of truth for what work is done — every script reads it before
// acting and re-running any step is safe.

const isoOrNull = z.string().nullable();

export const stepsSchema = z.object({
  ingested: isoOrNull,
  mezzanine: isoOrNull,
  proxy: isoOrNull,
  audio: isoOrNull,
  transcribed: isoOrNull,
  frames: isoOrNull,
  classified: isoOrNull,
});
export type Steps = z.infer<typeof stepsSchema>;
export type StepName = keyof Steps;

export const renderRecordSchema = z.object({
  previewAt: isoOrNull,
  finalAt: isoOrNull,
  verifiedAt: isoOrNull,
});
export type RenderRecord = z.infer<typeof renderRecordSchema>;

export const classificationSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]),
  topics: z.array(z.string()),
});

export const statusSchema = z.object({
  version: z.literal(STATUS_VERSION),
  videoId: z.string().min(1),
  originalFilename: z.string().min(1),
  createdAt: z.string(),
  steps: stepsSchema,
  contentType: z.string().nullable(),
  classification: classificationSchema.nullable(),
  renders: z.record(z.string(), renderRecordSchema),
  lastError: z
    .object({ step: z.string(), message: z.string(), at: z.string() })
    .nullable(),
});

export type Status = z.infer<typeof statusSchema>;

export const createStatus = (args: {
  videoId: string;
  originalFilename: string;
}): Status => ({
  version: STATUS_VERSION,
  videoId: args.videoId,
  originalFilename: args.originalFilename,
  createdAt: new Date().toISOString(),
  steps: {
    ingested: new Date().toISOString(),
    mezzanine: null,
    proxy: null,
    audio: null,
    transcribed: null,
    frames: null,
    classified: null,
  },
  contentType: null,
  classification: null,
  renders: {},
  lastError: null,
});

/** Returns a new Status with the given step stamped now (immutable). */
export const stampStep = (status: Status, step: StepName): Status => ({
  ...status,
  steps: { ...status.steps, [step]: new Date().toISOString() },
});

export const emptyRenderRecord = (): RenderRecord => ({
  previewAt: null,
  finalAt: null,
  verifiedAt: null,
});
