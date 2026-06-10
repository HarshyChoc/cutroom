import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORKSPACE_FILES } from "../../shared/constants";

// All filesystem locations, derived from this file's position so the CLI
// works no matter what directory it is invoked from. Node-only — never
// import this from remotion/ code.

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const CONTENT_DIR = path.join(REPO_ROOT, "content");
export const RAW_DIR = path.join(CONTENT_DIR, "raw");
export const LIBRARY_DIR = path.join(CONTENT_DIR, "library");
export const OUTPUT_DIR = path.join(CONTENT_DIR, "output");
export const ASSETS_DIR = path.join(CONTENT_DIR, "assets");
export const MUSIC_DIR = path.join(ASSETS_DIR, "music");
export const BRANDING_DIR = path.join(ASSETS_DIR, "branding");
export const SCOPES_DIR = path.join(REPO_ROOT, "scopes");
export const WHISPER_DIR = path.join(REPO_ROOT, ".whisper");
export const CONFIG_PATH = path.join(REPO_ROOT, "editor.config.json");
export const REMOTION_ENTRY = path.join(REPO_ROOT, "remotion", "index.ts");
export const REMOTION_PUBLIC_DIR = path.join(REPO_ROOT, "remotion", "public");

export interface VideoPaths {
  readonly dir: string;
  readonly probe: string;
  readonly status: string;
  readonly transcript: string;
  readonly whisperRaw: string;
  readonly analysis: string;
  readonly publish: string;
  readonly mediaDir: string;
  readonly mezzanine: string;
  readonly mezzanineProbe: string;
  readonly proxy: string;
  readonly audio: string;
  readonly framesDir: string;
  readonly framesIndex: string;
  readonly editsDir: string;
}

export const videoDir = (videoId: string): string =>
  path.join(LIBRARY_DIR, videoId);

export const videoPaths = (videoId: string): VideoPaths => {
  const dir = videoDir(videoId);
  return {
    dir,
    probe: path.join(dir, WORKSPACE_FILES.probe),
    status: path.join(dir, WORKSPACE_FILES.status),
    transcript: path.join(dir, WORKSPACE_FILES.transcript),
    whisperRaw: path.join(dir, WORKSPACE_FILES.whisperRaw),
    analysis: path.join(dir, WORKSPACE_FILES.analysis),
    publish: path.join(dir, WORKSPACE_FILES.publish),
    mediaDir: path.join(dir, WORKSPACE_FILES.mediaDir),
    mezzanine: path.join(dir, WORKSPACE_FILES.mezzanine),
    mezzanineProbe: path.join(dir, WORKSPACE_FILES.mezzanineProbe),
    proxy: path.join(dir, WORKSPACE_FILES.proxy),
    audio: path.join(dir, WORKSPACE_FILES.audio),
    framesDir: path.join(dir, WORKSPACE_FILES.framesDir),
    framesIndex: path.join(dir, WORKSPACE_FILES.framesIndex),
    editsDir: path.join(dir, WORKSPACE_FILES.editsDir),
  };
};

export interface EditPaths {
  readonly dir: string;
  readonly edit: string;
  readonly qcDir: string;
}

export const editPaths = (videoId: string, editName: string): EditPaths => {
  const dir = path.join(videoPaths(videoId).editsDir, editName);
  return {
    dir,
    edit: path.join(dir, "edit.json"),
    qcDir: path.join(dir, "qc"),
  };
};

export const outputPath = (
  videoId: string,
  editName: string,
  preview: boolean,
): string =>
  path.join(
    OUTPUT_DIR,
    `${videoId}--${editName}${preview ? "--preview" : ""}.mp4`,
  );

/** Path relative to content/ — the form stored in EDLs and served over HTTP. */
export const contentRelPath = (absPath: string): string =>
  path.relative(CONTENT_DIR, absPath);
