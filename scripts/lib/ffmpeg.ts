import { stat } from "node:fs/promises";
import { execa } from "execa";
import { PROBE_VERSION } from "../../shared/constants";
import { probeSchema, type Probe } from "../../shared/schemas/probe";
import { EditorError } from "./errors";

// ffmpeg/ffprobe wrappers. Binaries resolve from PATH with env overrides.
// IMPORTANT: always execa with argument arrays — the repo path contains
// spaces and nothing here may ever pass through a shell.

export const ffmpegBin = (): string => process.env.EDITOR_FFMPEG ?? "ffmpeg";
export const ffprobeBin = (): string => process.env.EDITOR_FFPROBE ?? "ffprobe";

export const assertBinary = async (bin: string): Promise<void> => {
  try {
    await execa(bin, ["-version"]);
  } catch {
    throw new EditorError(
      `Could not run "${bin}".`,
      'Install ffmpeg with: brew install ffmpeg — or set EDITOR_FFMPEG/EDITOR_FFPROBE to the binary path.',
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
