import {
  AUDIO_SAMPLE_RATE,
  MAX_OUTPUT_FPS,
  MEZZANINE_CRF,
  MIN_OUTPUT_FPS,
  PROXY_CRF,
  PROXY_HEIGHT,
} from "../../shared/constants";
import type { Probe } from "../../shared/schemas/probe";
import { runFfmpeg } from "./ffmpeg";

// Mezzanine policy: every source is normalized ONCE into a predictable
// H.264 / CFR / SDR mp4 that Remotion and ffmpeg can both seek reliably.
// Raw phone footage (HEVC, HDR, variable frame rate, rotation tags) goes in;
// boring well-behaved video comes out. Everything downstream reads the
// mezzanine, never the original.

/** SDR tonemap chain for HDR (HLG / PQ) sources. Requires ffmpeg with zimg. */
const HDR_TONEMAP_FILTER = [
  "zscale=t=linear:npl=100",
  "format=gbrpf32le",
  "zscale=p=bt709",
  "tonemap=tonemap=hable:desat=0",
  "zscale=t=bt709:m=bt709:r=tv",
  "format=yuv420p",
].join(",");

export const mezzanineFps = (sourceFps: number): number =>
  Math.min(MAX_OUTPUT_FPS, Math.max(MIN_OUTPUT_FPS, Math.round(sourceFps)));

/** True when the source is already safe to use as-is (remux, no transcode). */
export const canRemux = (probe: Probe): boolean =>
  probe.codec === "h264" &&
  probe.pixFmt === "yuv420p" &&
  !probe.isVfr &&
  !probe.isHdr &&
  probe.rotation === 0;

export const makeMezzanine = async (
  source: string,
  dest: string,
  probe: Probe,
): Promise<void> => {
  if (canRemux(probe)) {
    const audioArgs = probe.audio
      ? ["-map", "0:a:0", "-c:a", "aac", "-b:a", "256k", "-ar", "48000"]
      : [];
    await runFfmpeg([
      "-i",
      source,
      "-map",
      "0:v:0",
      ...audioArgs,
      "-c:v",
      "copy",
      "-movflags",
      "+faststart",
      dest,
    ]);
    return;
  }

  const filters = probe.isHdr ? ["-vf", HDR_TONEMAP_FILTER] : [];
  const audioArgs = probe.audio
    ? ["-map", "0:a:0", "-c:a", "aac", "-b:a", "256k", "-ar", "48000"]
    : [];
  await runFfmpeg([
    "-i",
    source,
    "-map",
    "0:v:0",
    ...audioArgs,
    ...filters,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    String(MEZZANINE_CRF),
    "-pix_fmt",
    "yuv420p",
    "-fps_mode",
    "cfr",
    "-r",
    String(mezzanineFps(probe.fps)),
    "-movflags",
    "+faststart",
    dest,
  ]);
};

/** Small fast proxy for preview renders and Studio scrubbing. */
export const makeProxy = async (
  mezzanine: string,
  dest: string,
  hasAudio: boolean,
): Promise<void> => {
  const audioArgs = hasAudio ? ["-c:a", "aac", "-b:a", "96k"] : [];
  await runFfmpeg([
    "-i",
    mezzanine,
    "-vf",
    `scale=-2:${PROXY_HEIGHT}`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    String(PROXY_CRF),
    ...audioArgs,
    "-movflags",
    "+faststart",
    dest,
  ]);
};

/** 16 kHz mono loudness-normalized wav — exactly what whisper.cpp wants. */
export const extractWhisperAudio = async (
  mezzanine: string,
  dest: string,
): Promise<void> => {
  await runFfmpeg([
    "-i",
    mezzanine,
    "-vn",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ac",
    "1",
    "-ar",
    String(AUDIO_SAMPLE_RATE),
    "-c:a",
    "pcm_s16le",
    dest,
  ]);
};

/** Extract one still at tMs, scaled to the given width. */
export const extractFrame = async (
  videoFile: string,
  dest: string,
  tMs: number,
  width: number,
): Promise<void> => {
  await runFfmpeg([
    "-ss",
    (tMs / 1000).toFixed(3),
    "-i",
    videoFile,
    "-frames:v",
    "1",
    "-vf",
    `scale=${width}:-2`,
    "-q:v",
    "4",
    dest,
  ]);
};
