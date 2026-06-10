import { mkdir } from "node:fs/promises";
import { execa } from "execa";
import {
  downloadWhisperModel,
  installWhisperCpp,
} from "@remotion/install-whisper-cpp";
import { ensureBrowser } from "@remotion/renderer";
import { WHISPER_CPP_VERSION, WHISPER_MODELS, type WhisperModel } from "../../shared/constants";
import { EditorError } from "../lib/errors";
import { assertBinary, ffmpegBin, ffmpegSource, ffprobeBin } from "../lib/ffmpeg";
import { loadConfig } from "../lib/config";
import * as log from "../lib/log";
import {
  BRANDING_DIR,
  LIBRARY_DIR,
  MUSIC_DIR,
  OUTPUT_DIR,
  RAW_DIR,
  WHISPER_DIR,
} from "../lib/paths";

const MIN_NODE_MAJOR = 20;

export interface SetupOptions {
  readonly model?: string;
  readonly skipWhisper?: boolean;
  readonly skipBrowser?: boolean;
}

const checkNode = (): void => {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE_MAJOR) {
    throw new EditorError(
      `Node ${process.versions.node} is too old (need ${MIN_NODE_MAJOR}+).`,
      "Install a current Node LTS: brew install node — or use nvm.",
    );
  }
  log.ok(`Node ${process.versions.node}`);
};

const checkXcodeClt = async (): Promise<void> => {
  try {
    await execa("xcode-select", ["-p"]);
    log.ok("Xcode command line tools present");
  } catch {
    log.warn(
      "Xcode command line tools not found — whisper.cpp cannot compile without them.",
    );
    log.hint("Run: xcode-select --install  (then re-run setup)");
  }
};

const resolveModel = (requested: string | undefined, fallback: WhisperModel): WhisperModel => {
  if (requested === undefined) {
    return fallback;
  }
  if ((WHISPER_MODELS as readonly string[]).includes(requested)) {
    return requested as WhisperModel;
  }
  throw new EditorError(
    `Unknown whisper model "${requested}".`,
    `Valid models: ${WHISPER_MODELS.join(", ")}`,
  );
};

export const runSetup = async (options: SetupOptions): Promise<void> => {
  log.step("Checking environment");
  checkNode();
  await assertBinary(ffmpegBin());
  await assertBinary(ffprobeBin());
  log.ok(`ffmpeg + ffprobe (${ffmpegSource()}${ffmpegSource() === "bundled" ? " — installed via npm, no brew needed" : ""})`);
  await checkXcodeClt();

  log.step("Creating directories");
  // NOTE: .whisper/ is intentionally NOT pre-created — installWhisperCpp
  // treats an existing directory as "already installed" and skips the build.
  const dirs = [RAW_DIR, LIBRARY_DIR, OUTPUT_DIR, MUSIC_DIR, BRANDING_DIR];
  await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));
  log.ok("content/ directories ready");

  const config = await loadConfig();
  log.ok("editor.config.json loaded");

  if (options.skipWhisper) {
    log.warn("Skipping whisper.cpp install (--skip-whisper)");
  } else {
    log.step(`Installing whisper.cpp ${WHISPER_CPP_VERSION} (first run compiles, ~1 min)`);
    const { alreadyExisted } = await installWhisperCpp({
      to: WHISPER_DIR,
      version: WHISPER_CPP_VERSION,
      printOutput: false,
    });
    log.ok(alreadyExisted ? "whisper.cpp already installed" : "whisper.cpp installed");

    const model = resolveModel(options.model, config.whisper.model);
    log.step(`Downloading whisper model "${model}" (skipped if cached)`);
    let lastPct = -1;
    const result = await downloadWhisperModel({
      model,
      folder: WHISPER_DIR,
      printOutput: false,
      onProgress: (downloadedBytes, totalBytes) => {
        const pct = Math.floor((downloadedBytes / totalBytes) * 10) * 10;
        if (pct > lastPct) {
          lastPct = pct;
          log.info(`model download: ${pct}%`);
        }
      },
    });
    log.ok(
      result.alreadyExisted ? `model "${model}" already cached` : `model "${model}" downloaded`,
    );
  }

  if (options.skipBrowser) {
    log.warn("Skipping browser download (--skip-browser)");
  } else {
    log.step("Ensuring Remotion headless browser (downloads once)");
    await ensureBrowser();
    log.ok("headless browser ready");
  }

  log.step("Setup complete");
  log.info("Drop video files into content/raw/ then run:");
  log.info("  npm run editor -- ingest");
};
