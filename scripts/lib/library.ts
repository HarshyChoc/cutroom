import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import { statusSchema, type Status } from "../../shared/schemas/status";
import { probeSchema, type Probe } from "../../shared/schemas/probe";
import {
  transcriptSchema,
  type Transcript,
} from "../../shared/schemas/transcript";
import { EditorError } from "./errors";
import { videoPaths, LIBRARY_DIR } from "./paths";

// Typed, validated read/write of per-video state files. Everything is parsed
// through zod at the boundary; writes are pretty-printed JSON so the files
// stay hand-editable and diff-friendly.

export const readJsonFile = async <T>(
  file: string,
  schema: ZodType<T>,
): Promise<T> => {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new EditorError(
      `Missing file: ${file}`,
      "An earlier pipeline step probably hasn't run yet. Run `npm run editor -- status` to see what's next.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new EditorError(
      `Invalid JSON in ${file}: ${err instanceof Error ? err.message : err}`,
      "The file is corrupted or was hand-edited with a syntax error. Fix the JSON or regenerate it.",
    );
  }
  return schema.parse(parsed);
};

export const writeJsonFile = async <T>(
  file: string,
  schema: ZodType<T>,
  value: T,
): Promise<void> => {
  const validated = schema.parse(value);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
};

export const readStatus = (videoId: string): Promise<Status> =>
  readJsonFile(videoPaths(videoId).status, statusSchema);

export const writeStatus = (videoId: string, status: Status): Promise<void> =>
  writeJsonFile(videoPaths(videoId).status, statusSchema, status);

/** Read-modify-write with an immutable updater. Returns the new status. */
export const updateStatus = async (
  videoId: string,
  update: (current: Status) => Status,
): Promise<Status> => {
  const current = await readStatus(videoId);
  const next = update(current);
  await writeStatus(videoId, next);
  return next;
};

export const readProbe = (videoId: string): Promise<Probe> =>
  readJsonFile(videoPaths(videoId).probe, probeSchema);

export const readTranscript = (videoId: string): Promise<Transcript> =>
  readJsonFile(videoPaths(videoId).transcript, transcriptSchema);

/** All video ids in the library, oldest first (ids sort chronologically). */
export const listVideoIds = async (): Promise<readonly string[]> => {
  let entries;
  try {
    entries = await readdir(LIBRARY_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
};

/** Resolve a possibly-partial id (unique prefix or substring match). */
export const resolveVideoId = async (idOrPrefix: string): Promise<string> => {
  const ids = await listVideoIds();
  if (ids.includes(idOrPrefix)) {
    return idOrPrefix;
  }
  const matches = ids.filter((id) => id.includes(idOrPrefix));
  if (matches.length === 1) {
    return matches[0] as string;
  }
  if (matches.length === 0) {
    throw new EditorError(
      `No video found matching "${idOrPrefix}".`,
      "Run `npm run editor -- status` to list all videos.",
    );
  }
  throw new EditorError(
    `"${idOrPrefix}" matches ${matches.length} videos: ${matches.join(", ")}`,
    "Use a longer, unambiguous portion of the id.",
  );
};
