import { existsSync } from "node:fs";
import { buildCaptionPages } from "../../shared/caption-build";
import { segmentsHash } from "../../shared/edit-helpers";
import { editSchema, type Edit } from "../../shared/schemas/edit";
import { EditorError } from "../lib/errors";
import { readJsonFile, readTranscript, resolveVideoId, writeJsonFile } from "../lib/library";
import * as log from "../lib/log";
import { editPaths } from "../lib/paths";

// `editor captions` — deterministically (re)build captions.pages from the
// transcript and current segments. Style and `enabled` are preserved; only
// pages + the desync hash are replaced. Run after every segment change.

export interface CaptionsOptions {
  readonly edit: string;
}

export const runCaptions = async (
  idOrPrefix: string,
  options: CaptionsOptions,
): Promise<void> => {
  const videoId = await resolveVideoId(idOrPrefix);
  const targets = editPaths(videoId, options.edit);
  if (!existsSync(targets.edit)) {
    throw new EditorError(
      `No edit "${options.edit}" for ${videoId}.`,
      `Run: npm run editor -- plan-init ${videoId} --edit ${options.edit}`,
    );
  }

  const edit = await readJsonFile(targets.edit, editSchema);
  const transcript = await readTranscript(videoId);

  if (transcript.words.length === 0) {
    log.warn("Transcript has no words (no speech?) — writing empty caption pages.");
  }

  const pages = buildCaptionPages(transcript.words, edit);
  const updated: Edit = {
    ...edit,
    captions: {
      ...edit.captions,
      pages: [...pages],
      builtFromSegmentsHash: segmentsHash(edit),
    },
  };
  await writeJsonFile(targets.edit, editSchema, updated);

  const wordCount = pages.reduce((n, p) => n + p.tokens.length, 0);
  log.ok(`${pages.length} caption pages (${wordCount} words) → ${targets.edit}`);
  if (pages.length > 0) {
    log.hint("Proofread the pages for typos (whisper isn't perfect), then: editor validate");
  }
};
