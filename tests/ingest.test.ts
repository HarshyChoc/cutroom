import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { runIngest } from "../scripts/commands/ingest";
import { makeVideoId } from "../scripts/lib/ids";
import { videoDir } from "../scripts/lib/paths";
import { ffmpegBin } from "../scripts/lib/ffmpeg";

test("ingest preserves original media by default", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cutroom-ingest-"));
  const file = path.join(dir, "cutroom-test.mp4");
  let workspace: string | undefined;
  try {
    await execa(ffmpegBin(), [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=black:s=96x96:d=0.2",
      "-c:v", "libx264", file,
    ]);
    const metadata = await stat(file);
    const before = await readFile(file);
    const id = makeVideoId({
      filename: path.basename(file),
      sizeBytes: metadata.size,
      mtimeMs: metadata.mtimeMs,
    });
    workspace = videoDir(id);

    await runIngest({ file });
    assert.deepEqual(await readFile(file), before);
    assert.deepEqual(await readFile(path.join(workspace, "source.mp4")), before);

    await runIngest({ file });
    assert.deepEqual(await readFile(file), before);
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

test("contradictory copy and move options fail before reading files", async () => {
  await assert.rejects(
    runIngest({ file: "/does-not-exist", copy: true, move: true }),
    /Choose --copy or --move/,
  );
});
