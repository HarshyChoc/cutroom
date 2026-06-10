# irl-vlog

## Identity

Out-in-the-world footage: day-in-the-life, events, travel, behind-the-scenes.
The edit's job is momentum and place — fast scene changes, captions only when
someone speaks, let visuals breathe between lines.

## Hook rules

Open on the most visually striking or chaotic moment, not the start of the
day. A short `headline` text overlay can set context ("POV: launch day").

## Pacing & cuts

- Scene-driven: cut to a new moment every 1.5–4 seconds.
- Speech segments stay intact (lighter trimming than talking-head); B-camera
  silence gets cut hard.
- `speed: 1.25-2` on walking/setup/transition shots is encouraged.

## Captions

`clean-lower` preset, 4–5 words per page, no uppercase. Only over speech —
no captions on ambient/visual shots.

## Zooms

Rare. A slow glide (`ease-in-out`, 1.0 → 1.08 across the segment) on one
hero shot max. No snap punch-ins.

## Title cards & overlays

`context` pills to label places/times ("day 2", "3am"). No hook title cards —
the footage is the hook.

## Music

Strongly recommended: pick an energetic bed from content/assets/music/ at
volume 0.15 with ducking enabled (speech dips it automatically). If the
folder is empty, ask Seyvik for a track instead of skipping silently.

## Don'ts

- Don't crop wide establishing shots to oblivion — use `fit-blur` for the
  one or two shots where the wide matters.
- Don't caption ambient noise or background chatter.

## Defaults

```yaml
targetDurationSec: 25-60
captionPreset: clean-lower
maxWordsPerPage: 5
uppercase: false
captionYPct: 72
zoomDefault: 1.08
music: pick-from-assets
endCard: false
```
