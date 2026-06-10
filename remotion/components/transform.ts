import type { Segment } from "../../shared/schemas/edit";

// Pure crop/zoom math — no React, no Remotion imports, unit-testable.
// All values are percentages of the OUTPUT canvas, resolution-independent,
// so the same edit renders correctly against the mezzanine or the proxy.

export interface CoverLayout {
  /** Video element size as % of canvas. Aspect ratio is preserved. */
  readonly widthPct: number;
  readonly heightPct: number;
  /** Video element position as % of canvas. */
  readonly leftPct: number;
  readonly topPct: number;
}

/**
 * Cover-fit a source into the canvas, cropping the overflow.
 * xPct picks the horizontal crop center: -100 = left edge of the source,
 * 0 = center, 100 = right edge. (Vertical slack is always centered.)
 */
export const coverLayout = (
  sourceAspect: number,
  outputAspect: number,
  xPct: number,
): CoverLayout => {
  if (sourceAspect >= outputAspect) {
    const widthPct = 100 * (sourceAspect / outputAspect);
    const slack = widthPct - 100;
    return {
      widthPct,
      heightPct: 100,
      leftPct: -slack / 2 - (xPct / 100) * (slack / 2),
      topPct: 0,
    };
  }
  const heightPct = 100 * (outputAspect / sourceAspect);
  const slack = heightPct - 100;
  return { widthPct: 100, heightPct, leftPct: 0, topPct: -slack / 2 };
};

/** Contain-fit (letterbox) — used for the foreground in fit-blur mode. */
export const containLayout = (
  sourceAspect: number,
  outputAspect: number,
): CoverLayout => {
  if (sourceAspect >= outputAspect) {
    const heightPct = 100 * (outputAspect / sourceAspect);
    return {
      widthPct: 100,
      heightPct,
      leftPct: 0,
      topPct: (100 - heightPct) / 2,
    };
  }
  const widthPct = 100 * (sourceAspect / outputAspect);
  return {
    widthPct,
    heightPct: 100,
    leftPct: (100 - widthPct) / 2,
    topPct: 0,
  };
};

export interface ZoomState {
  readonly scale: number;
  /** Pan as % of canvas size. Positive xPct moves the image right. */
  readonly panXPct: number;
  readonly panYPct: number;
}

export const IDENTITY_ZOOM: ZoomState = { scale: 1, panXPct: 0, panYPct: 0 };

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/** Evaluate a segment's zoom keyframes at output time tMs (segment-relative). */
export const computeZoom = (
  transform: NonNullable<Segment["transform"]>,
  tMs: number,
): ZoomState => {
  const kfs = transform.keyframes;
  const first = kfs[0];
  const last = kfs[kfs.length - 1];
  if (!first || !last) {
    return IDENTITY_ZOOM;
  }
  if (tMs <= first.tMs) {
    return { scale: first.scale, panXPct: first.xPct, panYPct: first.yPct };
  }
  if (tMs >= last.tMs || transform.easing === "hold") {
    // hold = step function: snap to the last keyframe at or before tMs.
    const active = transform.easing === "hold"
      ? [...kfs].reverse().find((kf) => kf.tMs <= tMs) ?? first
      : last;
    return { scale: active.scale, panXPct: active.xPct, panYPct: active.yPct };
  }

  const nextIndex = kfs.findIndex((kf) => kf.tMs > tMs);
  const b = kfs[nextIndex];
  const a = kfs[nextIndex - 1];
  if (!a || !b) {
    return { scale: last.scale, panXPct: last.xPct, panYPct: last.yPct };
  }
  const raw = (tMs - a.tMs) / (b.tMs - a.tMs);
  const t = transform.easing === "linear" ? raw : easeInOut(raw);
  const lerp = (from: number, to: number): number => from + (to - from) * t;
  return {
    scale: lerp(a.scale, b.scale),
    panXPct: lerp(a.xPct, b.xPct),
    panYPct: lerp(a.yPct, b.yPct),
  };
};
