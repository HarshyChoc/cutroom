---
name: new-scope
description: Create a new content-type scope doc by interviewing Seyvik in plain language. Use when classification finds no fitting type, or Seyvik wants a new style.
---

# Create a new scope doc

The scope doc is the creative contract for a content type. Build it WITH
Seyvik — don't invent his taste for him.

## Interview (plain language, one question at a time)

1. "What is this kind of video? Show me an example you love (a link or a
   creator's name)." — fills **Identity**.
2. "How should it open — straight into the action, or with a big text
   title?" — fills **Hook rules**.
3. "Fast and choppy, or let it breathe?" — fills **Pacing**.
4. "Captions: big bold center-screen, or smaller and clean? All caps?"
   — fills **Captions** + Defaults.
5. "Zooms: punchy, subtle, or none?" — fills **Zooms**.
6. "Music under it? What vibe?" — fills **Music** (check what's actually in
   content/assets/music/).
7. "How long should these run, max?" — fills `targetDurationSec`.
8. "Anything you never want to see in these?" — fills **Don'ts**.

## Then

1. Copy `scopes/_template.md` → `scopes/<type-name>.md` (lowercase-dashes
   name Seyvik agrees to).
2. Fill every section from his answers — keep his phrasing where you can.
3. Translate the choices into the Defaults block (valid EDL values only:
   preset names from `shared/schemas/edit.ts`).
4. Read it back to him in one short paragraph: "So: cold opens, choppy cuts,
   big yellow captions, no music, under 40s. Right?" Adjust until he says yes.
5. Classify the waiting video against the new type and continue the pipeline.
