// Pure constants shared by scripts/ (node) and remotion/ (browser bundle).
// NOTHING in this file may import node builtins — it is bundled into the renderer.
// Node-only path constants live in scripts/lib/paths.ts.

export const EDIT_VERSION = 1;
export const PROBE_VERSION = 1;
export const STATUS_VERSION = 1;
export const TRANSCRIPT_VERSION = 1;
export const CONFIG_VERSION = 1;

/** whisper.cpp release pinned to the version Remotion's installer is tested against. */
export const WHISPER_CPP_VERSION = "1.5.5";

export const WHISPER_MODELS = [
  "tiny",
  "tiny.en",
  "base",
  "base.en",
  "small",
  "small.en",
  "medium",
  "medium.en",
  "large-v3",
  "large-v3-turbo",
] as const;
export type WhisperModel = (typeof WHISPER_MODELS)[number];

export const CAPTION_PRESETS = ["bold-center", "clean-lower", "minimal"] as const;
export type CaptionPreset = (typeof CAPTION_PRESETS)[number];

export const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".mkv",
  ".webm",
  ".avi",
  ".mts",
  ".m2ts",
] as const;

/** Composition id registered in remotion/Root.tsx. */
export const COMPOSITION_ID = "EditRenderer";

/** Filenames inside a per-video workspace (content/library/<id>/). */
export const WORKSPACE_FILES = {
  probe: "probe.json",
  status: "status.json",
  transcript: "transcript.json",
  whisperRaw: "whisper-raw.json",
  analysis: "analysis.md",
  publish: "publish.md",
  mediaDir: "media",
  mezzanine: "media/mezzanine.mp4",
  mezzanineProbe: "media/mezzanine.json",
  proxy: "media/proxy.mp4",
  audio: "media/audio-16k.wav",
  framesDir: "frames",
  framesIndex: "frames/index.json",
  editsDir: "edits",
} as const;

export const DEFAULT_EDIT_NAME = "main";

/** Mezzanine / proxy encoding targets (see scripts/lib/ffmpeg.ts). */
export const MEZZANINE_CRF = 17;
export const PROXY_HEIGHT = 540;
export const PROXY_CRF = 28;
export const AUDIO_SAMPLE_RATE = 16_000;

/** Renderer guard rails. */
export const MIN_OUTPUT_FPS = 24;
export const MAX_OUTPUT_FPS = 60;
export const MAX_SEGMENT_SPEED = 3;
export const MIN_SEGMENT_SPEED = 0.5;
export const MAX_ZOOM_SCALE = 4;

/** Caption pagination defaults (see shared/caption-build.ts). */
export const CAPTION_PAGE_GAP_MS = 800;
export const CAPTION_MAX_PAGE_DURATION_MS = 4_000;
export const CAPTION_HOLD_MS = 200;
export const CAPTION_MIN_TOKEN_MS = 60;
