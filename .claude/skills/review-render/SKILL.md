---
name: review-render
description: The quality loop — preview render, verify, visually inspect QC stills, fix the EDL, then final render. Use before declaring any edit done.
---

# Review a render

Never ship a final render you haven't looked at.

## Steps

1. `npm run editor -- render <id> --preview` (fast: proxy + half res).
2. `npm run editor -- verify <id>` — mechanical checks + QC stills into
   `content/library/<id>/edits/<name>/qc/`.
3. READ every QC still (vision). Checklist:
   - [ ] captions fully on screen, legible, not covering the subject's face
   - [ ] no typos / mishearings left in visible pages
   - [ ] framing: subject centered — if not, set `reframe.xPct` (or
         per-segment `reframe`) and re-render
   - [ ] hook card readable, gone before it overstays (≤ ~1.8s)
   - [ ] overlays timed to the moment they comment on
   - [ ] punch-ins land on emphasis, not mid-word weirdness
4. Anything off → fix `edit.json` → `captions` if segments changed →
   `validate` → back to step 1.
5. Clean? `npm run editor -- render <id>` (final, full res).
6. `npm run editor -- verify <id>` again (now checks the final + stamps it).
7. `open "content/output/<id>--<edit>.mp4"` so the creator sees the result.

## When QC stills aren't enough

Stills can't show motion problems (jarring cuts, zoom speed). If the creator
reports something feels off, open the preview file itself and scrub it, or
launch `npm run editor -- studio <id>` and step through the timeline.
