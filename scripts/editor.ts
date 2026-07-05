import { Command } from "commander";
import { handleFatal } from "./lib/errors";

// CLI entry point. Subcommand implementations are lazy-imported so fast
// commands (status) don't pay for heavy modules (renderer, whisper).

const program = new Command();

program
  .name("editor")
  .description("Claude-driven video editing pipeline (see CLAUDE.md)")
  .showHelpAfterError();

program
  .command("setup")
  .description("Check tools, install whisper.cpp + model, download render browser")
  .option("--model <model>", "whisper model to download (default: from editor.config.json)")
  .option("--skip-whisper", "skip whisper.cpp install/model download")
  .option("--skip-browser", "skip headless browser download")
  .action(async (opts) => {
    const { runSetup } = await import("./commands/setup");
    await runSetup(opts);
  });

program
  .command("ingest")
  .description("Move videos from content/raw/ into the library (probe + workspace)")
  .option("--copy", "copy instead of move (leaves originals in place)")
  .option("--file <path>", "ingest a single file from anywhere")
  .action(async (opts) => {
    const { runIngest } = await import("./commands/ingest");
    await runIngest(opts);
  });

program
  .command("analyze")
  .description("Create mezzanine/proxy/audio, transcribe, sample frames")
  .argument("[id]", "video id (or unique fragment)")
  .option("--all", "analyze every video that needs it")
  .option("--force", "redo all sub-steps even if already done")
  .option("--skip-transcribe", "create media and frames without speech-to-text")
  .action(async (id, opts) => {
    const { runAnalyze } = await import("./commands/analyze");
    await runAnalyze(id, opts);
  });

program
  .command("transcribe")
  .description("Speech-to-text with word timestamps")
  .argument("<id>", "video id (or unique fragment)")
  .option("--provider <provider>", "transcription provider: whisper or elevenlabs", "whisper")
  .option("--model <model>", "override provider model for this run")
  .option("--channel-source <sourceId=path>", "multichannel Scribe input source", (value, previous: string[] = []) => [...previous, value], [])
  .option("--force", "re-transcribe even if transcript exists")
  .action(async (id, opts) => {
    const { runTranscribe } = await import("./commands/transcribe");
    await runTranscribe(id, opts);
  });

program
  .command("frames")
  .description("Sample stills for visual classification")
  .argument("<id>", "video id (or unique fragment)")
  .option("--count <n>", "number of frames", (v) => Number(v))
  .option("--force", "resample even if frames exist")
  .action(async (id, opts) => {
    const { runFrames } = await import("./commands/frames");
    await runFrames(id, opts);
  });

program
  .command("plan-init")
  .description("Scaffold a minimal valid edit.json for a video")
  .argument("<id>", "video id (or unique fragment)")
  .option("--edit <name>", "edit name", "main")
  .action(async (id, opts) => {
    const { runPlanInit } = await import("./commands/plan-init");
    await runPlanInit(id, opts);
  });

program
  .command("captions")
  .description("(Re)build caption pages in edit.json from the transcript + segments")
  .argument("<id>", "video id (or unique fragment)")
  .option("--edit <name>", "edit name", "main")
  .action(async (id, opts) => {
    const { runCaptions } = await import("./commands/captions");
    await runCaptions(id, opts);
  });

program
  .command("validate")
  .description("Validate an edit.json (schema + sanity checks)")
  .argument("<id>", "video id (or unique fragment)")
  .option("--edit <name>", "edit name", "main")
  .action(async (id, opts) => {
    const { runValidate } = await import("./commands/validate");
    await runValidate(id, opts);
  });

program
  .command("render")
  .description("Render an edit to content/output/")
  .argument("<id>", "video id (or unique fragment)")
  .option("--edit <name>", "edit name", "main")
  .option("--preview", "fast low-res preview render (uses proxy)")
  .option("--open", "open the rendered file when done")
  .action(async (id, opts) => {
    const { runRender } = await import("./commands/render");
    await runRender(id, opts);
  });

program
  .command("verify")
  .description("Check a render's duration/resolution and extract QC stills")
  .argument("<id>", "video id (or unique fragment)")
  .option("--edit <name>", "edit name", "main")
  .action(async (id, opts) => {
    const { runVerify } = await import("./commands/verify");
    await runVerify(id, opts);
  });

program
  .command("studio")
  .description("Open Remotion Studio with a video's edit loaded")
  .argument("[id]", "video id (or unique fragment)")
  .option("--edit <name>", "edit name", "main")
  .action(async (id, opts) => {
    const { runStudio } = await import("./commands/studio");
    await runStudio(id, opts);
  });

program
  .command("status")
  .description("Show every video's pipeline stage and next step")
  .option("--json", "machine-readable output")
  .action(async (opts) => {
    const { runStatus } = await import("./commands/status");
    await runStatus(opts);
  });

program.parseAsync(process.argv).catch(handleFatal);
