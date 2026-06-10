import { Config } from "@remotion/cli/config";

// Entry point + public dir for `npx remotion studio` / CLI usage.
// IMPORTANT: publicDir must stay tiny (fonts/branding only). Footage is served
// over the local media server (scripts/lib/media-server.ts), never bundled —
// Remotion copies the entire publicDir into every render bundle.
Config.setEntryPoint("./remotion/index.ts");
Config.setPublicDir("./remotion/public");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
