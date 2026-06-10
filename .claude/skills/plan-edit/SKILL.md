---
name: plan-edit
description: Turn a classified video into an edit.json — choose cuts from the transcript, zooms, overlays, captions per the scope doc. The core creative skill.
---

# Plan an edit

Inputs: `transcript.json`, `analysis.md`, `scopes/<contentType>.md`,
`scopes/_global.md`. Output: a validated `edits/<name>/edit.json`.

## Steps

1. Read `scopes/_global.md` + the type's scope doc. Note the Defaults block
   values and the target duration.
2. `npm run editor -- plan-init <id>` — scaffolds `edits/main/edit.json`.
3. **Plan the cut on paper first** (in your head/notes, from transcript words):
   - Mark the hook (from analysis.md). It must play within the first 3s —
     reorder segments if needed (segments can jump around source time).
   - Walk the words; build keep-ranges. Drop: gaps > ~700ms, filler words,
     false starts, weak tangents. Keep: complete thoughts.
   - Cut between words: segment boundary ≥ word A's `endMs` + 80 and
     ≤ word B's `startMs` − 80. NEVER inside a word's [startMs, endMs].
   - Sum the kept time ÷ speed — hit the scope's target duration. Too long?
     Cut the weakest thought, don't speed everything up.
4. Write `segments` into edit.json: stable ids (`seg-01`…), `note` on each
   explaining why it survived.
5. Apply the scope's zoom policy via `transform` keyframes (`tMs` is
   OUTPUT-relative to the segment start; single keyframe = static punch-in).
6. Overlays per scope: hook title card (≤ 1800ms), context pills, end card.
   Times are OUTPUT clock — compute from your segment durations.
7. Copy the Defaults block values into `captions.style` / `output`.
8. `npm run editor -- captions <id>` — builds the karaoke pages.
9. Proofread every page in edit.json; fix mishearings by editing token
   `text` only.
10. `npm run editor -- validate <id>` — fix anything it flags, re-validate.

## Time math reminder

`sourceInMs/sourceOutMs` = mezzanine clock. Everything else = output clock.
Output duration of a segment = (out − in) ÷ speed. Segments play in array
order regardless of source order.

## Worked micro-example

Transcript: hook lives at source 21000–24500, intro 0–8000 is decent,
9500–18000 is the story. Target ~30s:

```json
"segments": [
  { "id": "seg-01", "sourceInMs": 21000, "sourceOutMs": 24500, "note": "million-view line as cold open",
    "transform": { "keyframes": [{ "tMs": 0, "scale": 1.2 }], "easing": "hold" } },
  { "id": "seg-02", "sourceInMs": 80,   "sourceOutMs": 8000,  "note": "setup: gear myth" },
  { "id": "seg-03", "sourceInMs": 9500, "sourceOutMs": 18000, "note": "consistency story" },
  { "id": "seg-04", "sourceInMs": 24500, "sourceOutMs": 27500, "note": "CTA: hit record" }
]
```

Caption pages and overlay times then live on the OUTPUT timeline:
seg-01 occupies 0–3500, seg-02 occupies 3500–11420, etc.
