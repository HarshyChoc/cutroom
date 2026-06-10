---
name: publish-prep
description: Write publish.md for a finished edit — platform-native titles, captions, hashtags, and a cover-frame suggestion for TikTok/Reels/Shorts.
---

# Prep publish copy

After a final render passes review, write
`content/library/<id>/publish.md`.

## Rules (platform-native, not generic)

- Hooks beat summaries. The caption's first line must create a curiosity gap,
  not describe the video ("I wasted $3k so you don't have to" > "My thoughts
  on camera gear").
- One idea per caption. No hashtag soup — 3–5 relevant tags, niche > broad.
- Don't repeat the video's opening line verbatim as the caption — complement
  it.
- Suggest a cover frame: pick the QC still (or timestamp) with the strongest
  face/emotion/text moment.

## Template

```markdown
# Publish: <id> / <edit>

## TikTok
**Caption:** <hook line> <1 short context line> #tag1 #tag2 #tag3
**Cover:** qc-03 (the punch-in on "million views")

## Instagram Reels
**Caption:** <can be slightly longer, line-broken for readability>
**First comment:** <extra tags if needed>

## YouTube Shorts
**Title:** <≤ 60 chars, curiosity-first>
**Description:** <1-2 lines + tags>

## Notes
- best posting window / series potential / what to A-B test next time
```

Keep it tight — Seyvik should be able to copy-paste each block directly.
