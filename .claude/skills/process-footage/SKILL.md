---
name: process-footage
description: The orchestrator — use when Seyvik says "I dropped some videos", "make me shorts", or wants the whole pipeline run on pending footage. Sweeps raw/, analyzes, classifies, plans, renders, reviews. Resumable at any point.
---

# Process footage end-to-end

Run the full pipeline for every pending video. Each step is resumable —
`editor status` always tells you where things stand.

## Steps

1. `npm run editor -- status` — see what exists and what stage each video is at.
2. `npm run editor -- ingest` — if Seyvik mentioned new files (or raw/ has any).
3. `npm run editor -- analyze --all` — slow (transcription); tell Seyvik
   roughly how long: ~real-time per video on first run. It continues past
   per-video failures and reports them at the end.
4. For each analyzed video: **classify** it (use the `classify` skill).
5. For each classified video: **plan the edit** (use the `plan-edit` skill).
6. Preview render + review (use the `review-render` skill).
7. Final render + verify + `publish.md` (use the `publish-prep` skill).
8. Summarize for Seyvik: per video — type, what you did creatively (from your
   segment notes), where the output file is. Open the best one:
   `open "content/output/<file>"`.

## Batch etiquette

- Work videos one at a time through plan→render so an early misunderstanding
  (wrong type, wrong style) is caught before you've rendered ten videos.
- If one video errors, note it, continue the rest, report at the end.
- Long source (> 3 min) that contains multiple ideas? Suggest `clip-hunt`
  to Seyvik instead of one long edit.
