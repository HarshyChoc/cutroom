import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadWhisperModel,
  toCaptions,
  transcribe,
  type Language,
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
  type TranscriptWord,
} from "../../shared/schemas/transcript";
import { stampStep } from "../../shared/schemas/status";
import { loadConfig } from "../lib/config";
import { EditorError } from "../lib/errors";
import { runFfmpeg } from "../lib/ffmpeg";
import {
  readProbe,
  resolveVideoId,
  updateStatus,
  writeJsonFile,
} from "../lib/library";
import * as log from "../lib/log";
import { videoPaths, WHISPER_DIR } from "../lib/paths";
import { extractWhisperAudio } from "../lib/transcode";

export interface TranscribeOptions {
  readonly provider?: string;
  readonly model?: string;
  readonly force?: boolean;
  readonly channelSource?: readonly string[];
}

type TranscriptionProvider = "whisper" | "elevenlabs";

interface ChannelSource {
  readonly sourceId: string;
  readonly file: string;
}

interface ElevenLabsWord {
  readonly text?: string;
  readonly start?: number | null;
  readonly end?: number | null;
  readonly type?: string;
  readonly speaker_id?: string | null;
  readonly logprob?: number;
  readonly channel_index?: number | null;
}

interface ElevenLabsTranscript {
  readonly language_code?: string;
  readonly text?: string;
  readonly words?: readonly ElevenLabsWord[];
  readonly channel_index?: number | null;
}

type ElevenLabsResponse =
  | ElevenLabsTranscript
  | {
      readonly transcripts?: readonly ElevenLabsTranscript[];
      readonly audio_duration_secs?: number | null;
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

const resolveProvider = (requested: string | undefined): TranscriptionProvider => {
  if (requested === undefined || requested === "whisper") {
    return "whisper";
  }
  if (requested === "elevenlabs") {
    return "elevenlabs";
  }
  throw new EditorError(
    `Unknown transcription provider "${requested}".`,
    "Valid providers: whisper, elevenlabs",
  );
};

const parseChannelSources = (
  specs: readonly string[] | undefined,
): readonly ChannelSource[] => {
  if (!specs || specs.length === 0) {
    return [];
  }
  return specs.map((spec) => {
    const eq = spec.indexOf("=");
    if (eq <= 0 || eq === spec.length - 1) {
      throw new EditorError(
        `Invalid channel source "${spec}".`,
        "Use --channel-source sourceId=/absolute/or/relative/path.mp4",
      );
    }
    const sourceId = spec.slice(0, eq).trim();
    const file = path.resolve(spec.slice(eq + 1).trim());
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(sourceId)) {
      throw new EditorError(
        `Invalid source id "${sourceId}".`,
        "Use letters, digits and dashes only, e.g. host or guest-1.",
      );
    }
    if (!existsSync(file)) {
      throw new EditorError(`Channel source not found: ${file}`);
    }
    return { sourceId, file };
  });
};

const safeFileId = (sourceId: string): string => sourceId.replace(/[^a-z0-9-]/gi, "-");

const buildScribeAudio = async (
  videoId: string,
  channelSources: readonly ChannelSource[],
): Promise<{ readonly audioFile: string; readonly sourceIdsByChannel: readonly string[] }> => {
  const paths = videoPaths(videoId);
  if (channelSources.length === 0) {
    if (!existsSync(paths.audio)) {
      throw new EditorError(
        `No extracted audio for ${videoId}.`,
        `Run: npm run editor -- analyze ${videoId} --skip-transcribe`,
      );
    }
    return { audioFile: paths.audio, sourceIdsByChannel: [] };
  }
  if (channelSources.length < 2) {
    throw new EditorError(
      "Scribe multichannel transcription needs at least two --channel-source values.",
    );
  }

  await mkdir(paths.mediaDir, { recursive: true });
  const monoFiles: string[] = [];
  for (const source of channelSources) {
    const mono = path.join(paths.mediaDir, `scribe-channel-${safeFileId(source.sourceId)}.wav`);
    await extractWhisperAudio(source.file, mono);
    monoFiles.push(mono);
  }

  const inputs = monoFiles.flatMap((file) => ["-i", file]);
  const mergeInputs = monoFiles.map((_, i) => `[${i}:a]`).join("");
  await runFfmpeg([
    ...inputs,
    "-filter_complex",
    `${mergeInputs}amerge=inputs=${monoFiles.length}[a]`,
    "-map",
    "[a]",
    "-ac",
    String(monoFiles.length),
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    paths.scribeAudio,
  ]);

  return {
    audioFile: paths.scribeAudio,
    sourceIdsByChannel: channelSources.map((source) => source.sourceId),
  };
};

const confidenceFromLogprob = (logprob: number | undefined): number | null => {
  if (logprob === undefined || !Number.isFinite(logprob)) {
    return null;
  }
  return Math.max(0, Math.min(1, Math.exp(logprob)));
};

const normalizeElevenLabsWords = (
  raw: ElevenLabsResponse,
  sourceIdsByChannel: readonly string[],
): { readonly language: string; readonly text: string; readonly words: readonly TranscriptWord[] } => {
  const transcripts: readonly ElevenLabsTranscript[] =
    "transcripts" in raw && Array.isArray(raw.transcripts)
      ? raw.transcripts
      : [raw as ElevenLabsTranscript];
  const words = transcripts.flatMap((transcript, transcriptIndex) =>
    (transcript.words ?? []).flatMap((word): TranscriptWord[] => {
      if (word.type !== undefined && word.type !== "word") {
        return [];
      }
      if (word.text === undefined || word.start == null || word.end == null) {
        return [];
      }
      const cleanText = word.text.trim();
      if (cleanText.length === 0) {
        return [];
      }
      const channelIndex = word.channel_index ?? transcript.channel_index ?? transcriptIndex;
      const sourceId =
        channelIndex != null && sourceIdsByChannel[channelIndex] !== undefined
          ? sourceIdsByChannel[channelIndex]
          : undefined;
      return [
        {
          text: cleanText,
          startMs: Math.max(0, Math.round(word.start * 1000)),
          endMs: Math.max(0, Math.round(word.end * 1000)),
          confidence: confidenceFromLogprob(word.logprob),
          ...(sourceId ? { sourceId } : {}),
          ...(word.speaker_id ? { speakerId: word.speaker_id } : {}),
          ...(channelIndex != null ? { channelIndex } : {}),
        },
      ];
    }),
  );
  const sorted = words
    .filter((word) => word.endMs > word.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
    .map((word, i) => ({
      ...word,
      text: i === 0 ? word.text.trim() : ` ${word.text.trim()}`,
    }));
  const firstTranscript = transcripts[0];
  return {
    language: firstTranscript?.language_code ?? "unknown",
    text: transcripts.map((transcript) => transcript.text ?? "").join("\n").trim(),
    words: sorted,
  };
};

const transcribeWithElevenLabs = async (
  videoId: string,
  options: TranscribeOptions,
): Promise<Transcript> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new EditorError(
      "ELEVENLABS_API_KEY is not set.",
      "Set it in the shell for this run only; do not put it in repo files.",
    );
  }

  const model = options.model ?? "scribe_v2";
  if (!["scribe_v2", "scribe_v1"].includes(model)) {
    throw new EditorError(
      `Unknown ElevenLabs speech-to-text model "${model}".`,
      "Use scribe_v2 unless you intentionally need scribe_v1.",
    );
  }

  const channelSources = parseChannelSources(options.channelSource);
  const { audioFile, sourceIdsByChannel } = await buildScribeAudio(videoId, channelSources);
  log.info(
    sourceIdsByChannel.length > 0
      ? `transcribing with ElevenLabs ${model} (${sourceIdsByChannel.length} channels)…`
      : `transcribing with ElevenLabs ${model}…`,
  );

  const form = new FormData();
  const audio = await readFile(audioFile);
  form.append(
    "file",
    new Blob([audio], { type: "audio/wav" }),
    path.basename(audioFile),
  );
  form.append("model_id", model);
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("no_verbatim", "false");
  if (sourceIdsByChannel.length > 0) {
    form.append("use_multi_channel", "true");
  }
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new EditorError(
      `ElevenLabs Scribe failed (${response.status}).`,
      bodyText.slice(0, 800),
    );
  }

  const raw = JSON.parse(bodyText) as ElevenLabsResponse;
  const paths = videoPaths(videoId);
  await writeFile(paths.elevenLabsRaw, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  const normalized = normalizeElevenLabsWords(raw, sourceIdsByChannel);
  const transcript: Transcript = {
    version: TRANSCRIPT_VERSION,
    videoId,
    language: normalized.language,
    model,
    text:
      normalized.text.length > 0
        ? normalized.text
        : normalized.words.map((word) => word.text).join("").trim(),
    words: [...normalized.words],
    generatedAt: new Date().toISOString(),
  };
  await writeJsonFile(paths.transcript, transcriptSchema, transcript);
  return transcript;
};

/** Core transcription, reused by `editor analyze`. Writes transcript.json. */
export const transcribeVideo = async (
  videoId: string,
  options: TranscribeOptions,
): Promise<Transcript> => {
  const paths = videoPaths(videoId);
  const config = await loadConfig();
  const probe = await readProbe(videoId);
  const provider = resolveProvider(options.provider);
  if (provider === "elevenlabs") {
    return transcribeWithElevenLabs(videoId, options);
  }
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
    // Config validates shape; whisper.cpp errors loudly on unknown codes.
    language: config.whisper.language as Language,
    printOutput: false,
  });
  await writeFile(
    paths.whisperRaw,
    `${JSON.stringify(whisperOutput, null, 2)}\n`,
    "utf8",
  );

  const { captions } = toCaptions({ whisperCppOutput: whisperOutput });
  // Whisper emits BPE tokens: a token starting with " " begins a new word;
  // anything else ("Cr" + "ickets.") continues the previous one. Merge so
  // transcript words are real words — karaoke captions depend on this.
  const words: TranscriptWord[] = [];
  for (const c of captions) {
    const prev = words[words.length - 1];
    const continuesPrev = prev !== undefined && !c.text.startsWith(" ");
    if (continuesPrev) {
      words[words.length - 1] = {
        ...prev,
        text: prev.text + c.text,
        endMs: Math.max(prev.endMs, Math.round(c.endMs)),
        confidence:
          prev.confidence !== null && c.confidence !== null
            ? Math.min(prev.confidence, c.confidence)
            : prev.confidence,
      };
    } else {
      words.push({
        text: c.text,
        startMs: Math.max(0, Math.round(c.startMs)),
        endMs: Math.max(0, Math.round(c.endMs)),
        confidence: c.confidence ?? null,
      });
    }
  }

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
