import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadWhisperModel,
  toCaptions,
  transcribe,
} from "@remotion/install-whisper-cpp";
import {
  TRANSCRIPT_VERSION,
  WHISPER_CPP_VERSION,
  WHISPER_MODELS,
  type WhisperModel,
} from "../../shared/constants";
import {
  transcriptSchema,
  type Transcript,
} from "../../shared/schemas/transcript";
import { stampStep } from "../../shared/schemas/status";
import { loadConfig } from "../lib/config";
import { EditorError } from "../lib/errors";
import {
  readProbe,
  resolveVideoId,
  updateStatus,
  writeJsonFile,
} from "../lib/library";
import * as log from "../lib/log";
import { videoPaths, WHISPER_DIR } from "../lib/paths";

export interface TranscribeOptions {
  readonly model?: string;
  readonly force?: boolean;
}

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

const ensureModel = async (model: WhisperModel): Promise<void> => {
  // installWhisperCpp checks out whisper.cpp directly into WHISPER_DIR.
  if (!existsSync(path.join(WHISPER_DIR, "Makefile"))) {
    throw new EditorError("whisper.cpp is not installed.", "Run: npm run setup");
  }
  const modelFile = path.join(WHISPER_DIR, `ggml-${model}.bin`);
  if (!existsSync(modelFile)) {
    log.info(`model "${model}" not cached — downloading…`);
    let lastPct = -1;
    await downloadWhisperModel({
      model,
      folder: WHISPER_DIR,
      printOutput: false,
      onProgress: (downloaded, total) => {
        const pct = Math.floor((downloaded / total) * 10) * 10;
        if (pct > lastPct) {
          lastPct = pct;
          log.info(`model download: ${pct}%`);
        }
      },
    });
  }
};

/** Core transcription, reused by `editor analyze`. Writes transcript.json. */
export const transcribeVideo = async (
  videoId: string,
  options: TranscribeOptions,
): Promise<Transcript> => {
  const paths = videoPaths(videoId);
  const config = await loadConfig();
  const probe = await readProbe(videoId);
  const model = resolveModel(options.model, config.whisper.model);

  if (probe.audio === null) {
    log.warn(`${videoId} has no audio track — writing an empty transcript.`);
    const empty: Transcript = {
      version: TRANSCRIPT_VERSION,
      videoId,
      language: config.whisper.language,
      model: "none",
      text: "",
      words: [],
      generatedAt: new Date().toISOString(),
    };
    await writeJsonFile(paths.transcript, transcriptSchema, empty);
    return empty;
  }

  if (!existsSync(paths.audio)) {
    throw new EditorError(
      `No extracted audio for ${videoId}.`,
      `Run: npm run editor -- analyze ${videoId}`,
    );
  }

  await ensureModel(model);
  log.info(`transcribing with whisper.cpp (${model})…`);
  const whisperOutput = await transcribe({
    inputPath: paths.audio,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_CPP_VERSION,
    model,
    tokenLevelTimestamps: true,
    language: config.whisper.language,
    printOutput: false,
  });
  await writeFile(
    paths.whisperRaw,
    `${JSON.stringify(whisperOutput, null, 2)}\n`,
    "utf8",
  );

  const { captions } = toCaptions({ whisperCppOutput: whisperOutput });
  const words = captions.map((c) => ({
    text: c.text,
    startMs: Math.max(0, Math.round(c.startMs)),
    endMs: Math.max(0, Math.round(c.endMs)),
    confidence: c.confidence ?? null,
  }));

  const transcript: Transcript = {
    version: TRANSCRIPT_VERSION,
    videoId,
    language: config.whisper.language,
    model,
    text: words.map((w) => w.text).join(""),
    words,
    generatedAt: new Date().toISOString(),
  };
  await writeJsonFile(paths.transcript, transcriptSchema, transcript);
  return transcript;
};

export const runTranscribe = async (
  idOrPrefix: string,
  options: TranscribeOptions,
): Promise<void> => {
  const videoId = await resolveVideoId(idOrPrefix);
  const paths = videoPaths(videoId);

  if (existsSync(paths.transcript) && !options.force) {
    log.warn(`${videoId} already has a transcript — use --force to redo.`);
    return;
  }

  log.step(`Transcribing ${videoId}`);
  const transcript = await transcribeVideo(videoId, options);
  await updateStatus(videoId, (s) => stampStep(s, "transcribed"));
  log.ok(
    `${transcript.words.length} words → ${paths.transcript}`,
  );
  if (transcript.words.length > 0) {
    const preview = transcript.text.trim().slice(0, 120);
    log.info(`"${preview}${transcript.text.length > 120 ? "…" : ""}"`);
  }
};
