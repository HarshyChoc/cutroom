import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Status } from "../../shared/schemas/status";
import { listVideoIds, readProbe, readStatus } from "../lib/library";
import * as log from "../lib/log";
import { videoPaths } from "../lib/paths";
import { formatMs } from "../../shared/time";

// `editor status` — the first command of every session. Shows where each
// video is in the pipeline and what to run next.

type Stage =
  | "error"
  | "ingested"
  | "analyzed"
  | "classified"
  | "planned"
  | "rendered"
  | "done";

interface StatusRow {
  readonly videoId: string;
  readonly stage: Stage;
  readonly contentType: string;
  readonly duration: string;
  readonly edits: readonly string[];
  readonly next: string;
}

const listEdits = async (videoId: string): Promise<readonly string[]> => {
  const editsDir = videoPaths(videoId).editsDir;
  try {
    const entries = await readdir(editsDir, { withFileTypes: true });
    return entries
      .filter(
        (e) => e.isDirectory() && existsSync(path.join(editsDir, e.name, "edit.json")),
      )
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

const computeStage = (status: Status, edits: readonly string[]): Stage => {
  if (status.lastError) {
    return "error";
  }
  const renders = Object.values(status.renders);
  if (renders.some((r) => r.finalAt && r.verifiedAt)) {
    return "done";
  }
  if (renders.some((r) => r.finalAt || r.previewAt)) {
    return "rendered";
  }
  if (edits.length > 0) {
    return "planned";
  }
  if (status.steps.classified) {
    return "classified";
  }
  if (status.steps.transcribed && status.steps.frames && status.steps.mezzanine) {
    return "analyzed";
  }
  return "ingested";
};

const NEXT_COMMAND: Record<Stage, string> = {
  error: "check status.json lastError, fix, re-run the failed step",
  ingested: "editor analyze <id>",
  analyzed: "classify it (see CLAUDE.md), then editor plan-init <id>",
  classified: "editor plan-init <id>",
  planned: "editor render <id> --preview",
  rendered: "editor verify <id>, review QC frames, then final render",
  done: "nothing — output is in content/output/",
};

const buildRow = async (videoId: string): Promise<StatusRow> => {
  const status = await readStatus(videoId);
  const probe = await readProbe(videoId).catch(() => null);
  const edits = await listEdits(videoId);
  const stage = computeStage(status, edits);
  return {
    videoId,
    stage,
    contentType: status.contentType ?? "-",
    duration: probe ? formatMs(probe.durationMs) : "?",
    edits,
    next: NEXT_COMMAND[stage],
  };
};

const pad = (value: string, width: number): string =>
  value.length >= width ? value : value + " ".repeat(width - value.length);

export const runStatus = async (options: { json?: boolean }): Promise<void> => {
  const ids = await listVideoIds();
  const rows: StatusRow[] = [];
  const broken: { videoId: string; message: string }[] = [];
  for (const id of ids) {
    try {
      rows.push(await buildRow(id));
    } catch (err) {
      broken.push({
        videoId: id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ videos: rows, broken }, null, 2));
    return;
  }

  if (rows.length === 0 && broken.length === 0) {
    log.warn("Library is empty.");
    log.hint("Drop videos into content/raw/ and run: npm run editor -- ingest");
    return;
  }

  const idWidth = Math.max(8, ...rows.map((r) => r.videoId.length)) + 2;
  log.heading(
    `${pad("VIDEO", idWidth)}${pad("STAGE", 12)}${pad("TYPE", 16)}${pad("LEN", 7)}EDITS`,
  );
  for (const row of rows) {
    console.log(
      `${pad(row.videoId, idWidth)}${pad(row.stage, 12)}${pad(row.contentType, 16)}${pad(row.duration, 7)}${row.edits.join(", ") || "-"}`,
    );
    console.log(log.dim(`${" ".repeat(idWidth)}next: ${row.next}`));
  }
  for (const b of broken) {
    log.fail(`${b.videoId}: unreadable state — ${b.message}`);
  }
};
