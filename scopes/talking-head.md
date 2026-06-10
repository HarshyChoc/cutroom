# talking-head

## Identity

One person talking directly to camera: takes, advice, rants, storytimes.
The edit's job is energy — kill every dead moment, punch the emphasis, make
the captions carry viewers watching on mute.

## Hook rules

Open on the single strongest line, even if it comes from mid-video — reorder
segments so it leads. Add a `hook` title card (≤ 1.8s) only when the line
alone isn't visual enough. Never open with greetings or context-setting.

## Pacing & cuts

- Aggressive jump cuts: every pause > 500ms gets cut.
- Cut filler words ("um", "uh", "like, you know", false starts) ruthlessly.
- A cut every 2–5 seconds keeps energy up; pair cuts with punch-in changes.
- Natural speed; use `speed: 1.05-1.15` only on visibly slow passages.

## Captions

`bold-center`, 3–4 words per page, uppercase, default yellow highlight.
They're the main visual — keep them at yPct 70.

## Zooms

Alternate full frame ↔ punch-in (`scale: 1.15`, `easing: hold`) at cut
points for emphasis. Strongest claim of the video gets 1.25. Don't glide —
talking heads want snaps.

## Title cards & overlays

Hook card when needed (see above). A `sticker` text overlay ("REAL TALK",
"WAIT FOR IT") at most once per video. End card only if the scope of the
video is a series.

## Music

None by default — the voice is the content. If Seyvik asks for one, volume
0.08 with ducking enabled.

## Don'ts

- No fit-blur mode — always crop to fill the frame.
- Don't caption over the speaker's face: if the face sits low in frame,
  move captions up (yPct 60).

## Defaults

```yaml
targetDurationSec: 20-45
captionPreset: bold-center
maxWordsPerPage: 4
uppercase: true
captionYPct: 70
zoomDefault: 1.15
music: none
endCard: false
```
