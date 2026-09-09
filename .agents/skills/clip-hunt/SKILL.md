---
name: clip-hunt
description: Mine a long source video for multiple self-contained shorts. Use when a video is over ~3 minutes or contains several distinct ideas.
---

# Clip-hunt a long video

One long source → several named edits, each a complete short.

## Steps

1. Read the full transcript. Map the distinct ideas/moments — for each
   candidate clip you need: a hook line, a complete arc (setup → payoff),
   and a clean exit line. 2–5 candidates is typical.
2. Rank them. Tell the creator what you found before rendering all of them:
   "I see 3 clips here: (1) the launch story, (2) the pricing rant,
   (3) the demo fail. Want all three?"
3. For each approved clip:
   - `npm run editor -- plan-init <id> --edit <slug>` (e.g. `--edit pricing-rant`)
   - Plan it with the `plan-edit` skill — each clip stands alone: its own
     hook in the first 3s, no "as I said earlier" context debt. Cut those
     references out or don't ship the clip.
   - `captions` / `validate` / preview / review as usual (every command takes
     `--edit <slug>`).
4. Render finals. Files land as `content/output/<id>--<slug>.mp4`.
5. One `publish.md` covering all clips (sectioned per clip), with a suggested
   posting order and spacing.

## Naming

Edit slugs: short, content-derived, lowercase-dashes (`pricing-rant`,
`demo-fail`). Never reuse a slug within a video.
