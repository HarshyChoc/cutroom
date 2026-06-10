# Editor For Seyvik

Drop raw footage in a folder, talk to Claude, get edited vertical shorts out.

This repo is a Claude Code workspace: Claude reads your footage's transcript
and frames, figures out what kind of content it is, follows your editing
style docs (`scopes/`), writes an edit plan, and renders it with
[Remotion](https://remotion.dev) — cuts, karaoke captions, 9:16 reframe,
punch-in zooms, title cards, music.

## One-time setup (Mac)

```bash
# 1. Requirements: Node 20+ and Xcode command line tools
brew install node
xcode-select --install   # ok if it says already installed

# 2. Install (ffmpeg comes bundled automatically — no brew needed for it)
npm install
npm run setup            # compiles whisper.cpp, downloads the speech model (~1.5GB) + render browser
```

> Optional: `brew install ffmpeg` gives a newer system ffmpeg which the
> editor will automatically prefer over the bundled one.

Optional: rename `.claude/settings.example.json` → `.claude/settings.json`
so Claude doesn't ask permission for routine editor commands.

## Daily use

1. Drop video files into `content/raw/`.
2. Open this folder in Claude Code.
3. Say what you want: *"I dropped three videos — make me shorts."*

Claude takes it from there. It will ask you when it's unsure (e.g. a new
kind of content it hasn't seen), and shows you the finished file when done.
Finished videos land in `content/output/`.

## Teach it your style

Your editing taste lives in `scopes/` — one markdown doc per content type
(`talking-head.md`, `irl-vlog.md`, …). Edit them in plain English; Claude
follows them. Say *"let's set up a new content type"* and Claude will
interview you and write the doc (see `_template.md` for the shape).

Put music beds in `content/assets/music/` and Claude can use them (with
automatic ducking under speech).

## How it works (for the curious)

```
raw video ─ ingest → normalized mezzanine + word-timestamped transcript + frames
                ↓
        Claude classifies (reads transcript + frames) → matches a scopes/ doc
                ↓
        Claude writes edits/<name>/edit.json  ← THE edit: cuts, captions, zooms
                ↓
        Remotion renders it  →  content/output/<video>--<edit>.mp4
```

- Speech-to-text: local [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
  word-level timestamps — nothing is uploaded anywhere.
- The renderer is one generic Remotion composition driven entirely by
  `edit.json` (schema: `shared/schemas/edit.ts`).
- Everything is resumable: `npm run editor -- status` shows where each video
  stands.

## Licensing note

Remotion is free for individuals and companies of up to 3 people. Larger
companies need a [Remotion company license](https://remotion.pro).
