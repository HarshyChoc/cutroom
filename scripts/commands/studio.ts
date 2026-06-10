import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { editSchema } from "../../shared/schemas/edit";
import { loadConfig } from "../lib/config";
import { EditorError } from "../lib/errors";
import { readJsonFile, resolveVideoId } from "../lib/library";
import * as log from "../lib/log";
import { startMediaServer } from "../lib/media-server";
import { editPaths, REPO_ROOT } from "../lib/paths";

// `editor studio` — Remotion Studio with the media server alongside, so
// Seyvik can scrub an edit visually. Blocks until the studio is closed.

export interface StudioOptions {
  readonly edit: string;
}

export const runStudio = async (
  idOrPrefix: string | undefined,
  options: StudioOptions,
): Promise<void> => {
  const config = await loadConfig();
  const args = ["remotion", "studio"];

  if (idOrPrefix) {
    const videoId = await resolveVideoId(idOrPrefix);
    const targets = editPaths(videoId, options.edit);
    if (!existsSync(targets.edit)) {
      throw new EditorError(
        `No edit "${options.edit}" for ${videoId}.`,
        `Run: npm run editor -- plan-init ${videoId} --edit ${options.edit}`,
      );
    }
    const edit = await readJsonFile(targets.edit, editSchema);
    const props = {
      edit,
      mediaBaseUrl: `http://127.0.0.1:${config.mediaServerPort}`,
    };
    const propsFile = path.join(REPO_ROOT, ".remotion", "studio-props.json");
    await mkdir(path.dirname(propsFile), { recursive: true });
    await writeFile(propsFile, JSON.stringify(props), "utf8");
    args.push("--props", propsFile);
    log.ok(`loaded ${videoId} / ${options.edit}`);
  }

  const server = await startMediaServer(config.mediaServerPort);
  log.ok(`media server on ${server.baseUrl}`);
  log.info("Starting Remotion Studio — close it (Ctrl-C) when done.");
  try {
    await execa("npx", args, { cwd: REPO_ROOT, stdio: "inherit" });
  } finally {
    await server.close();
  }
};
