import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execa } from "execa";
import { COMPOSITION_ID, WORKSPACE_FILES } from "../../shared/constants";
import { editSchema, type Edit } from "../../shared/schemas/edit";
import { emptyRenderRecord } from "../../shared/schemas/status";
import { EditorError } from "../lib/errors";
import { readJsonFile, resolveVideoId, updateStatus } from "../lib/library";
import * as log from "../lib/log";
import { startMediaServer } from "../lib/media-server";
import {
  editPaths,
  outputPath,
  OUTPUT_DIR,
  REMOTION_ENTRY,
  REMOTION_PUBLIC_DIR,
  videoPaths,
} from "../lib/paths";
import { validateEdit } from "../lib/validate-edit";

export interface RenderOptions {
  readonly edit: string;
  readonly preview?: boolean;
  readonly open?: boolean;
}

const FINAL_CRF = 18;
const PREVIEW_CRF = 28;
const PREVIEW_SCALE = 0.5;

/** For previews, point the edit at the small proxy instead of the mezzanine. */
const toPreviewEdit = (edit: Edit, videoId: string): Edit => {
  const paths = videoPaths(videoId);
  const toProxyRel = (relPath: string): string | null => {
    if (relPath === WORKSPACE_FILES.mezzanine || relPath.endsWith(`/${WORKSPACE_FILES.mezzanine}`)) {
      const proxyRel = relPath.replace(
        WORKSPACE_FILES.mezzanine,
        WORKSPACE_FILES.proxy,
      );
      return existsSync(paths.proxy) ? proxyRel : null;
    }
    const proxyRel = relPath.replace(/-mezzanine\.mp4$/, "-proxy.mp4");
    if (proxyRel !== relPath && existsSync(path.join(OUTPUT_DIR, "..", proxyRel))) {
      return proxyRel;
    }
    return null;
  };

  const sourceProxyRel = toProxyRel(edit.source.relPath);
  if (sourceProxyRel === null) {
    log.warn("No proxy found for primary source — preview will decode the full mezzanine (slower).");
  }
  return {
    ...edit,
    source:
      sourceProxyRel === null
        ? edit.source
        : { ...edit.source, relPath: sourceProxyRel },
    sources: edit.sources.map((source) => {
      const proxyRel = toProxyRel(source.relPath);
      if (proxyRel === null) {
        log.warn(`No proxy found for source "${source.id}" — preview will decode full source.`);
        return source;
      }
      return { ...source, relPath: proxyRel };
    }),
  };
};

export const runRender = async (
  idOrPrefix: string,
  options: RenderOptions,
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
  const issues = validateEdit(edit);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    for (const issue of errors) {
      log.fail(`${issue.where}: ${issue.message}`);
    }
    throw new EditorError(
      "edit.json has validation errors — refusing to render.",
      `Fix the fields above, or run: npm run editor -- validate ${videoId} --edit ${options.edit}`,
    );
  }
  for (const issue of issues.filter((i) => i.level === "warning")) {
    log.warn(`${issue.where}: ${issue.message}`);
  }

  const preview = options.preview ?? false;
  const renderEdit = preview ? toPreviewEdit(edit, videoId) : edit;
  const outFile = outputPath(videoId, options.edit, preview);
  await mkdir(OUTPUT_DIR, { recursive: true });

  log.step(`Rendering ${videoId} / ${options.edit}${preview ? " (preview)" : ""}`);
  const server = await startMediaServer();
  try {
    log.info("bundling composition…");
    const serveUrl = await bundle({
      entryPoint: REMOTION_ENTRY,
      publicDir: REMOTION_PUBLIC_DIR,
    });

    const inputProps = { edit: renderEdit, mediaBaseUrl: server.baseUrl };
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
    });

    log.info(
      `rendering ${composition.durationInFrames} frames at ${composition.width}x${composition.height}${preview ? ` ×${PREVIEW_SCALE}` : ""}…`,
    );
    let lastPct = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: preview ? PREVIEW_CRF : FINAL_CRF,
      scale: preview ? PREVIEW_SCALE : 1,
      outputLocation: outFile,
      inputProps,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct > lastPct) {
          lastPct = pct;
          log.info(`render: ${pct}%`);
        }
      },
    });
  } finally {
    await server.close();
  }

  await updateStatus(videoId, (s) => {
    const record = s.renders[options.edit] ?? emptyRenderRecord();
    const updated = preview
      ? { ...record, previewAt: new Date().toISOString() }
      : { ...record, finalAt: new Date().toISOString(), verifiedAt: null };
    return { ...s, renders: { ...s.renders, [options.edit]: updated } };
  });

  log.ok(`rendered → ${path.relative(process.cwd(), outFile)}`);
  log.hint(
    preview
      ? `Check it, then final render: npm run editor -- render ${videoId} --edit ${options.edit}`
      : `Verify it: npm run editor -- verify ${videoId} --edit ${options.edit}`,
  );
  if (options.open) {
    await execa("open", [outFile]);
  }
};
