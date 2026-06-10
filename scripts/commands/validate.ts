import { existsSync } from "node:fs";
import { outputDurationMs } from "../../shared/edit-helpers";
import { editSchema } from "../../shared/schemas/edit";
import { formatMs } from "../../shared/time";
import { EditorError } from "../lib/errors";
import { readJsonFile, resolveVideoId } from "../lib/library";
import * as log from "../lib/log";
import { editPaths } from "../lib/paths";
import { validateEdit } from "../lib/validate-edit";

export interface ValidateOptions {
  readonly edit: string;
}

export const runValidate = async (
  idOrPrefix: string,
  options: ValidateOptions,
): Promise<void> => {
  const videoId = await resolveVideoId(idOrPrefix);
  const targets = editPaths(videoId, options.edit);
  if (!existsSync(targets.edit)) {
    throw new EditorError(
      `No edit "${options.edit}" for ${videoId}.`,
      `Run: npm run editor -- plan-init ${videoId} --edit ${options.edit}`,
    );
  }

  log.step(`Validating ${videoId} / ${options.edit}`);
  // Schema errors throw here and get formatted by the global handler.
  const edit = await readJsonFile(targets.edit, editSchema);

  const issues = validateEdit(edit);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  for (const issue of errors) {
    log.fail(`${issue.where}: ${issue.message}`);
  }
  for (const issue of warnings) {
    log.warn(`${issue.where}: ${issue.message}`);
  }

  const duration = outputDurationMs(edit);
  log.info(
    `output: ${formatMs(duration)} (${duration}ms), ${edit.output.width}x${edit.output.height}@${edit.output.fps}fps, ` +
      `${edit.segments.length} segment(s), ${edit.captions.pages.length} caption page(s), ${edit.overlays.length} overlay(s)`,
  );

  if (errors.length > 0) {
    throw new EditorError(
      `${errors.length} validation error(s) — fix them before rendering.`,
      "Each error above names the exact field path in edit.json.",
    );
  }
  log.ok(warnings.length > 0 ? `valid with ${warnings.length} warning(s)` : "valid");
};
