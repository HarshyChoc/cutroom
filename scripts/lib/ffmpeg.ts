import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { execa } from "execa";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { PROBE_VERSION } from "../../shared/constants";
import { probeSchema, type Probe } from "../../shared/schemas/probe";
import { EditorError } from "./errors";

// ffmpeg/ffprobe wrappers. Binary resolution (cached per process):
//   1. EDITOR_FFMPEG / EDITOR_FFPROBE env overrides
//   2. system binaries from PATH (faster, fuller builds when installed)
//   3. the npm-bundled static binaries (zero-setup fallback — verified to
//      include zscale/tonemap for the HDR path)
// System/bundled are picked as a PAIR so probe and transcode never disagree.
// IMPORTANT: always execa with argument arrays — the repo path contains
// spaces and nothing here may ever pass through a shell.

interface ResolvedBins {
  readonly ffmpeg: string;
  readonly ffprobe: string;
  readonly source: "env" | "system" | "bundled";
}

const runsOk = (bin: string): boolean => {
  try {
    return spawnSync(bin, ["-version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
};

let cachedBins: ResolvedBins | null = null;

const resolveBins = (): ResolvedBins => {
  if (cachedBins) {
    return cachedBins;
  }
  const envFfmpeg = process.env.EDITOR_FFMPEG;
  const envFfprobe = process.env.EDITOR_FFPROBE;
  if (envFfmpeg || envFfprobe) {
    cachedBins = {
      ffmpeg: envFfmpeg ?? "ffmpeg",
      ffprobe: envFfprobe ?? "ffprobe",
      source: "env",
    };
  } else if (runsOk("ffmpeg") && runsOk("ffprobe")) {
    cachedBins = { ffmpeg: "ffmpeg", ffprobe: "ffprobe", source: "system" };
  } else if (ffmpegStatic && ffprobeStatic.path) {
    cachedBins = {
      ffmpeg: ffmpegStatic,
      ffprobe: ffprobeStatic.path,
      source: "bundled",
    };
  } else {
    throw new EditorError(
      "No usable ffmpeg found (system missing and no bundled binary for this platform).",
      "Install it with: brew install ffmpeg",
    );
  }
  return cachedBins;
};

export const ffmpegBin = (): string => resolveBins().ffmpeg;
export const ffprobeBin = (): string => resolveBins().ffprobe;
export const ffmpegSource = (): string => resolveBins().source;

export const assertBinary = async (bin: string): Promise<void> => {
  try {
    await execa(bin, ["-version"]);
  } catch {
    throw new EditorError(
      `Could not run "${bin}".`,
      "The bundled ffmpeg should make this automatic — try `npm install` again, or install system ffmpeg with: brew install ffmpeg",
    );
  }
};

export const runFfmpeg = async (args: readonly string[]): Promise<void> => {
  try {
    await execa(ffmpegBin(), ["-hide_banner", "-y", ...args]);
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: unknown }).stderr).split("\n").slice(-6).join("\n")
        : String(err);
    throw new EditorError(
      `ffmpeg failed:\n${stderr}`,
      "The source file may be corrupted or in an unsupported format. Try playing it in QuickTime to confirm it's valid.",
    );
  }
};

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
  sample_rate?: string;
  channels?: number;
  color_transfer?: string;
  color_primaries?: string;
  disposition?: { attached_pic?: number };
  side_data_list?: { rotation?: number }[];
  tags?: { rotate?: string };
}

interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: { duration?: string; size?: string };
}

const parseFraction = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }
  const [num, den] = value.split("/").map(Number);
  if (!num || !den || !Number.isFinite(num) || !Number.isFinite(den)) {
    return null;
  }
  return num / den;
};

const streamRotation = (stream: FfprobeStream): number => {
  const sideData = stream.side_data_list?.find((d) => d.rotation != null);
  if (sideData?.rotation != null) {
    return Math.round(sideData.rotation);
  }
  const tag = Number(stream.tags?.rotate);
  return Number.isFinite(tag) ? Math.round(tag) : 0;
};

const HDR_TRANSFERS = ["smpte2084", "arib-std-b67"];
const VFR_TOLERANCE = 1.01;

/** Probe a media file into the normalized, rotation-aware Probe shape. */
export const probeFile = async (file: string): Promise<Probe> => {
  let result: FfprobeResult;
  try {
    const { stdout } = await execa(ffprobeBin(), [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      file,
    ]);
    result = JSON.parse(stdout) as FfprobeResult;
  } catch {
    throw new EditorError(
      `Could not read media info from: ${file}`,
      "The file may not be a video, or may be corrupted.",
    );
  }

  const video = result.streams?.find(
    (s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1,
  );
  if (!video || !video.width || !video.height) {
    throw new EditorError(
      `No video stream found in: ${file}`,
      "Only video files belong in content/raw/. Audio-only or image files are not supported.",
    );
  }

  const audio = result.streams?.find((s) => s.codec_type === "audio");
  const rotation = streamRotation(video);
  const sideways = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;

  const avgFps = parseFraction(video.avg_frame_rate);
  const realFps = parseFraction(video.r_frame_rate);
  const fps = avgFps ?? realFps;
  if (!fps || fps <= 0) {
    throw new EditorError(`Could not determine frame rate of: ${file}`);
  }
  const isVfr =
    avgFps != null &&
    realFps != null &&
    Math.max(avgFps, realFps) / Math.min(avgFps, realFps) > VFR_TOLERANCE;

  const durationSec = Number(result.format?.duration ?? video.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new EditorError(`Could not determine duration of: ${file}`);
  }

  const sizeBytes = Number(result.format?.size ?? (await stat(file)).size);

  return probeSchema.parse({
    version: PROBE_VERSION,
    durationMs: Math.round(durationSec * 1000),
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
    fps: Math.round(fps * 1000) / 1000,
    codec: video.codec_name ?? "unknown",
    pixFmt: video.pix_fmt ?? null,
    rotation,
    isVfr,
    isHdr:
      HDR_TRANSFERS.includes(video.color_transfer ?? "") ||
      video.color_primaries === "bt2020",
    audio: audio
      ? {
          codec: audio.codec_name ?? "unknown",
          sampleRate: Number(audio.sample_rate ?? 48000),
          channels: audio.channels ?? 2,
        }
      : null,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
  });
};
