import { z } from "zod";
import {
  CAPTION_PRESETS,
  EDIT_VERSION,
  MAX_OUTPUT_FPS,
  MAX_SEGMENT_SPEED,
  MAX_ZOOM_SCALE,
  MIN_OUTPUT_FPS,
  MIN_SEGMENT_SPEED,
} from "../constants";

// THE Edit Decision List. This file is the contract between Claude (who
// writes edit.json) and the Remotion renderer (which consumes it).
//
// TIME RULES — the most important thing in this repo:
//   • All times are integer MILLISECONDS.
//   • segments[].sourceInMs / sourceOutMs are SOURCE-clock (the mezzanine).
//   • Everything else — captions, overlays, transform keyframe tMs — is
//     OUTPUT-clock (the finished video's timeline).

const ms = z.number().int().nonnegative();
const pct100 = z.number().min(-100).max(100);

// ---- video timeline --------------------------------------------------------

export const transformKeyframeSchema = z.object({
  /** OUTPUT time relative to this segment's start. */
  tMs: ms,
  scale: z.number().min(1).max(MAX_ZOOM_SCALE),
  xPct: pct100.default(0),
  yPct: pct100.default(0),
});
export type TransformKeyframe = z.infer<typeof transformKeyframeSchema>;

export const segmentTransformSchema = z.object({
  keyframes: z.array(transformKeyframeSchema).min(1),
  easing: z.enum(["hold", "linear", "ease-in-out"]).default("ease-in-out"),
});

export const segmentSchema = z
  .object({
    /** Stable handle, e.g. "seg-01". Keep ids when re-editing. */
    id: z.string().min(1),
    /** Optional source handle; omitted means edit.source. */
    sourceId: z.string().min(1).optional(),
    sourceInMs: ms,
    sourceOutMs: ms,
    speed: z.number().min(MIN_SEGMENT_SPEED).max(MAX_SEGMENT_SPEED).default(1),
    volume: z.number().min(0).max(2).default(1),
    /** Per-segment horizontal crop-center override (% of width from center). */
    reframe: z.object({ xPct: pct100 }).optional(),
    /** Punch-ins / zooms. Omit for a plain full-frame segment. */
    transform: segmentTransformSchema.optional(),
    transitionAfter: z.enum(["cut", "fade"]).default("cut"),
    /** Claude's rationale for this cut — keep it human-readable. */
    note: z.string().optional(),
  })
  .refine((s) => s.sourceOutMs > s.sourceInMs, {
    message: "sourceOutMs must be greater than sourceInMs",
  });
export type Segment = z.infer<typeof segmentSchema>;

// ---- captions (karaoke) ----------------------------------------------------

export const captionTokenSchema = z.object({
  /** Word text, leading space preserved (whisper convention). */
  text: z.string(),
  fromMs: ms,
  toMs: ms,
});
export type CaptionToken = z.infer<typeof captionTokenSchema>;

export const captionPageSchema = z.object({
  startMs: ms,
  endMs: ms,
  tokens: z.array(captionTokenSchema).min(1),
});
export type CaptionPage = z.infer<typeof captionPageSchema>;

export const captionStyleSchema = z.object({
  preset: z.enum(CAPTION_PRESETS).default("bold-center"),
  /** Vertical anchor as % of canvas height (70 = lower third). */
  yPct: z.number().min(10).max(90).default(70),
  maxWordsPerPage: z.number().int().min(1).max(8).default(4),
  fontSizePx: z.number().int().min(24).max(160).optional(),
  highlightColor: z.string().optional(),
  uppercase: z.boolean().optional(),
});

const imageMotionSchema = z
  .object({
    fromScale: z.number().min(1).max(MAX_ZOOM_SCALE).default(1.04),
    toScale: z.number().min(1).max(MAX_ZOOM_SCALE).default(1.14),
    fromXPct: pct100.default(0),
    toXPct: pct100.default(0),
    fromYPct: pct100.default(0),
    toYPct: pct100.default(0),
  })
  .prefault({});

export const captionsSchema = z.object({
  enabled: z.boolean().default(true),
  style: captionStyleSchema.prefault({}),
  /**
   * Built by `editor captions` from the transcript, in OUTPUT time.
   * Hand-fix typos here; re-run `editor captions` after changing segments.
   */
  pages: z.array(captionPageSchema).default([]),
  /** Set by `editor captions` to detect segment/caption desync. */
  builtFromSegmentsHash: z.string().optional(),
});

// ---- overlays ---------------------------------------------------------------

export const overlaySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("title-card"),
    startMs: ms,
    endMs: ms,
    title: z.string().min(1),
    subtitle: z.string().optional(),
    preset: z.enum(["hook", "chapter", "endcard"]).default("hook"),
  }),
  z.object({
    type: z.literal("text"),
    startMs: ms,
    endMs: ms,
    text: z.string().min(1),
    xPct: z.number().min(0).max(100).default(50),
    yPct: z.number().min(0).max(100).default(18),
    preset: z
      .enum(["hook", "headline", "callout", "context", "sticker"])
      .default("headline"),
  }),
  z.object({
    type: z.literal("image"),
    startMs: ms,
    endMs: ms,
    /** Relative to content/, e.g. "assets/broll/truemed/red-light.png". */
    src: z.string().min(1),
    fit: z.enum(["cover", "contain"]).default("cover"),
    opacity: z.number().min(0).max(1).default(1),
    motion: imageMotionSchema,
  }),
]);
export type Overlay = z.infer<typeof overlaySchema>;

// ---- audio -------------------------------------------------------------------

export const musicSchema = z.object({
  /** Relative to content/, e.g. "assets/music/chill.mp3". */
  src: z.string().min(1),
  volume: z.number().min(0).max(1).default(0.12),
  offsetMs: ms.default(0),
  fadeOutMs: ms.default(800),
  ducking: z
    .object({
      enabled: z.boolean().default(false),
      duckedVolume: z.number().min(0).max(1).default(0.04),
      attackMs: ms.default(150),
      releaseMs: ms.default(400),
    })
    .prefault({}),
});

// ---- root ---------------------------------------------------------------------

export const editSourceSchema = z.object({
  /** Optional handle for the primary source; additional sources require ids. */
  id: z.string().min(1).optional(),
  /** Relative to content/: "library/<id>/media/mezzanine.mp4". */
  relPath: z.string().min(1),
  durationMs: ms,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type EditSource = z.infer<typeof editSourceSchema>;

export const additionalEditSourceSchema = editSourceSchema.extend({
  id: z.string().min(1),
});
export type AdditionalEditSource = z.infer<typeof additionalEditSourceSchema>;

export const editSchema = z.object({
  version: z.literal(EDIT_VERSION),
  videoId: z.string().min(1),
  editName: z.string().min(1).default("main"),
  /** Working title — what this edit is, in one line. */
  title: z.string().min(1),
  /** Must match a scopes/<contentType>.md doc. */
  contentType: z.string().min(1),
  source: editSourceSchema,
  /** Extra synced camera/audio sources addressable by segments[].sourceId. */
  sources: z.array(additionalEditSourceSchema).default([]),
  reframe: z
    .object({
      mode: z.enum(["crop", "fit-blur"]).default("crop"),
      /** Default horizontal crop-center offset (% of width from center). */
      xPct: pct100.default(0),
    })
    .prefault({}),
  segments: z.array(segmentSchema).min(1),
  captions: captionsSchema.prefault({}),
  overlays: z.array(overlaySchema).default([]),
  music: musicSchema.optional(),
  output: z
    .object({
      width: z.number().int().positive().default(1080),
      height: z.number().int().positive().default(1920),
      fps: z.number().int().min(MIN_OUTPUT_FPS).max(MAX_OUTPUT_FPS).default(30),
    })
    .prefault({}),
});

export type Edit = z.infer<typeof editSchema>;
