import { readFile } from "node:fs/promises";
import {
  configSchema,
  defaultConfig,
  type EditorConfig,
} from "../../shared/schemas/config";
import { writeJsonFile } from "./library";
import { CONFIG_PATH } from "./paths";
import { EditorError } from "./errors";

/** Load editor.config.json, creating it with defaults on first run. */
export const loadConfig = async (): Promise<EditorConfig> => {
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf8");
  } catch {
    const config = defaultConfig();
    await writeJsonFile(CONFIG_PATH, configSchema, config);
    return config;
  }
  try {
    return configSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new EditorError(
      `editor.config.json is invalid: ${err instanceof Error ? err.message : err}`,
      "Fix the file by hand, or delete it and re-run `npm run setup` to regenerate defaults.",
    );
  }
};
