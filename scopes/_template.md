# <content-type-name>

> Copy this file to `scopes/<type-name>.md` (lowercase, dashes). The prose
> sections guide Claude's judgment; the Defaults block at the bottom is
> copied 1:1 into edit.json.

## Identity

What this content type IS, in 2-3 sentences. Examples of creators/videos
whose style this should match.

## Hook rules

What makes a strong opening for this type. Title card or cold open? What
should the first 3 seconds accomplish?

## Pacing & cuts

How aggressive are jump cuts? Keep or kill pauses? Target words-per-minute
feel? When to speed up (`speed: 1.1-1.5`) vs leave natural?

## Captions

Look and feel (preset), word count per page, uppercase or not, highlight
color preference.

## Zooms

When to punch in (emphasis? topic changes? every N seconds?), how strong
(1.1 subtle … 1.3 aggressive), snap (`hold`) or glide (`ease-in-out`)?

## Title cards & overlays

Hook card style, mid-video text overlays (context pills? stickers?), end
card with what CTA?

## Music

None / which vibe from content/assets/music/, at what volume, ducked under
speech or not.

## Don'ts

Type-specific things to never do.

## Defaults

```yaml
targetDurationSec: 25-45        # hard ceiling for this type
captionPreset: bold-center      # bold-center | clean-lower | minimal
maxWordsPerPage: 4
uppercase: true
captionYPct: 70
zoomDefault: 1.15
music: none                     # none | filename in assets/music/
endCard: false                  # true → add an endcard title-card overlay
```
