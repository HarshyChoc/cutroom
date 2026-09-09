---
name: classify
description: Decide what type of content a video is by reading its transcript and frames, then record the decision. Use after analyze, before plan-edit.
---

# Classify a video

Decide which `scopes/<type>.md` doc governs this video's edit.

## Steps

1. Read `content/library/<id>/transcript.json` — the `text` field.
2. Read `content/library/<id>/frames/index.json`, then READ (vision) 4–6 of
   the listed jpgs spread across the video.
3. List candidate types: `ls scopes/` (ignore `_template.md`, `_global.md`).
4. Decide. Signals:
   - one face talking at the camera the whole time → `talking-head`
   - moving camera, locations, ambient sound, sparse speech → `irl-vlog`
   - screen recording / gameplay dominates the frames → needs a screen-type
     scope (if none exists, see step 6)
5. Write `content/library/<id>/analysis.md`:

   ```markdown
   # Analysis: <id>
   - **Type:** talking-head (confidence: high)
   - **Topics:** consistency, gear myths, algorithm
   - **Hook candidates:** "one video hit a million views overnight" (src 21.2s) · opener "nobody tells you" (src 0.5s)
   - **Notable moments:** energy spike at 9.5s; trails off after 27.5s
   - **Suggested edits:** 1 main short; no extra clips (single idea)
   ```

6. Update `status.json` (read → modify → write, keep all other fields):
   set `contentType`, `classification: {confidence, topics}`, and
   `steps.classified` to the current ISO timestamp.
7. **Low confidence or no scope fits?** Stop and ask the creator — show them 2–3
   frames, say what you see, and offer to set up a new type with the
   `new-scope` skill. Never force a bad match: the scope doc drives every
   creative decision downstream.
