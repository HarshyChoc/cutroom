# Global rules — apply to EVERY edit

These hold no matter the content type. The per-type scope doc can tighten
these rules but never loosen them.

## Output

- Vertical 1080×1920 @ 30fps unless the scope doc says otherwise.
- Keep all text inside safe margins: nothing within 64px of the left/right
  edges, captions in the 55–75% vertical band (platform UI covers the rest).

## Hook

- Something must earn attention in the first 3 seconds: the strongest line,
  a title card, or both. Never open with silence, a slow walk-in, or "hey
  guys, welcome back".

## Cutting

- Cut dead air (gaps > ~700ms) and filler words by default.
- Never cut mid-word. Leave ~80ms breathing room around cuts.
- End the video on a strong line — don't let it trail off.

## Captions

- Captions on by default. Proofread every page; fix whisper's mishearings
  (names, brands, slang) before final render.

## Don'ts

- No copyrighted music Seyvik doesn't have rights to (only files he put in
  content/assets/music/).
- Don't stretch/distort the video (the renderer preserves aspect — keep it).
- Don't ship a final render whose QC stills you haven't actually looked at.
