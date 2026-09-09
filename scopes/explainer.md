# Explainer

## Identity

A speaker explains one useful idea. The finished clip should make sense without the surrounding recording.

## Hook and pacing

Open with the main idea or a concrete question the clip answers. Remove redundant pauses and false starts while preserving the speaker's meaning. Prefer a short complete thought over an arbitrary target duration.

## Captions and framing

Use short caption pages and comfortable safe margins. Keep the speaker visible when context matters. Use a punch-in only to emphasize a meaningful change; avoid cutting inside a word.

## Music and claims

Add music only when the user supplies licensed audio. Verify names and factual claims against the supplied source. Do not invent a promise or outcome to strengthen a hook.

## Defaults

Copy these into the matching fields of the scaffolded edit plan, then rebuild captions.

```json
{
  "captions": {
    "style": {
      "preset": "clean-lower",
      "yPct": 72,
      "maxWordsPerPage": 4
    }
  },
  "output": { "width": 1080, "height": 1920, "fps": 30 }
}
```
