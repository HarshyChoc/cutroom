import { existsSync } from "node:fs";
import { EDIT_VERSION } from "../../shared/constants";
import { editSchema, type Edit } from "../../shared/schemas/edit";
import { probeSchema } from "../../shared/schemas/probe";
import { loadConfig } from "../lib/config";
import { EditorError } from "../lib/errors";
import {
  readJsonFile,
  readProbe,
  readStatus,
  resolveVideoId,
  writeJsonFile,
} from "../lib/library";
import * as log from "../lib/log";
import { contentRelPath, editPaths, videoPaths } from "../lib/paths";

// `editor plan-init` — scaffold a minimal VALID edit.json. Claude edits from
// there; it never has to remember the envelope shape from scratch.

export interface PlanInitOptions {
  readonly edit: string;
}

const EDIT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const runPlanInit = async (
  idOrPrefix: string,
  options: PlanInitOptions,
): Promise<void> => {
  const videoId = await resolveVideoId(idOrPrefix);
  const editName = options.edit;
  if (!EDIT_NAME_PATTERN.test(editName)) {
    throw new EditorError(
      `Invalid edit name "${editName}".`,
      "Use lowercase letters, digits and dashes, e.g. main, clip-2, hook-test.",
    );
  }

  const paths = videoPaths(videoId);
  const targets = editPaths(videoId, editName);
  if (existsSync(targets.edit)) {
    throw new EditorError(
      `Edit "${editName}" already exists for ${videoId}.`,
      `Edit the existing file instead: ${targets.edit} — or pick a new name with --edit.`,
    );
  }
  if (!existsSync(paths.mezzanine)) {
    throw new EditorError(
      `${videoId} has no mezzanine yet.`,
      `Run: npm run editor -- analyze ${videoId}`,
    );
  }

  const config = await loadConfig();
  const status = await readStatus(videoId);
  // The mezzanine's own probe is authoritative for edit bounds (its duration
  // can differ from the original by a few ms after CFR normalization).
  const mezzProbe = existsSync(paths.mezzanineProbe)
    ? await readJsonFile(paths.mezzanineProbe, probeSchema)
    : await readProbe(videoId);

  const draft = {
    version: EDIT_VERSION,
    videoId,
    editName,
    title: status.originalFilename.replace(/\.[^.]+$/, ""),
    contentType: status.contentType ?? "unclassified",
    source: {
      relPath: contentRelPath(paths.mezzanine),
      durationMs: mezzProbe.durationMs,
      width: mezzProbe.width,
      height: mezzProbe.height,
    },
    segments: [
      {
        id: "seg-01",
        sourceInMs: 0,
        sourceOutMs: mezzProbe.durationMs,
        note: "full source — cut this down",
      },
    ],
    captions: {
      enabled: true,
      style: { preset: config.defaults.captionPreset },
      pages: [],
    },
    output: {
      width: config.defaults.width,
      height: config.defaults.height,
      fps: config.defaults.fps,
    },
  };

  // Parsing materializes all schema defaults into the file so Claude can see
  // every available knob when editing.
  const edit: Edit = editSchema.parse(draft);
  await writeJsonFile(targets.edit, editSchema, edit);

  log.ok(`scaffolded ${targets.edit}`);
  log.hint(
    "Plan the cut (see the plan-edit skill), then: editor captions, editor validate, editor render --preview",
  );
};
