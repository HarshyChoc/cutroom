import { z } from "zod";
import {
  CAPTION_PRESETS,
  CONFIG_VERSION,
  MAX_OUTPUT_FPS,
  MIN_OUTPUT_FPS,
  WHISPER_MODELS,
} from "../constants";

// Schema for editor.config.json — the operator-tweakable defaults.

export const configSchema = z.object({
  version: z.literal(CONFIG_VERSION),
  whisper: z.object({
    model: z.enum(WHISPER_MODELS),
    language: z.string().min(2),
  }),
  defaults: z.object({
    fps: z.number().int().min(MIN_OUTPUT_FPS).max(MAX_OUTPUT_FPS),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    captionPreset: z.enum(CAPTION_PRESETS),
  }),
  mediaServerPort: z.number().int().min(1024).max(65535),
  framesPerVideo: z.number().int().min(4).max(48),
});

export type EditorConfig = z.infer<typeof configSchema>;

export const defaultConfig = (): EditorConfig => ({
  version: CONFIG_VERSION,
  whisper: { model: "medium.en", language: "en" },
  defaults: { fps: 30, width: 1080, height: 1920, captionPreset: "bold-center" },
  mediaServerPort: 7878,
  framesPerVideo: 12,
});
