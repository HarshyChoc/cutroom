import type React from "react";
import type { z } from "zod";
import type { captionStyleSchema } from "../../../shared/schemas/edit";
import { FONT_FAMILY } from "../../fonts";

type CaptionStyle = z.infer<typeof captionStyleSchema>;

// All caption look-and-feel values live here, keyed by preset. Sizes are in
// px on the 1080-wide canvas and scale with output width.

export interface ResolvedCaptionStyle {
  readonly fontSizePx: number;
  readonly uppercase: boolean;
  readonly highlightColor: string;
  readonly textColor: string;
  readonly fontWeight: number;
  readonly lineStyle: React.CSSProperties;
  readonly tokenStroke: React.CSSProperties;
  readonly spokenOpacity: number;
}

const PRESETS = {
  "bold-center": {
    fontSizePx: 68,
    uppercase: true,
    highlightColor: "#FFD400",
    textColor: "#FFFFFF",
    fontWeight: 800,
    lineStyle: {},
    tokenStroke: {
      WebkitTextStroke: "10px rgba(0,0,0,0.9)",
      paintOrder: "stroke fill",
      textShadow: "0 6px 28px rgba(0,0,0,0.55)",
    } satisfies React.CSSProperties,
    spokenOpacity: 1,
  },
  "clean-lower": {
    fontSizePx: 50,
    uppercase: false,
    highlightColor: "#7CF5A0",
    textColor: "#FFFFFF",
    fontWeight: 700,
    lineStyle: {
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 18,
      padding: "14px 28px",
    } satisfies React.CSSProperties,
    tokenStroke: {},
    spokenOpacity: 1,
  },
  minimal: {
    fontSizePx: 42,
    uppercase: false,
    highlightColor: "#FFFFFF",
    textColor: "rgba(255,255,255,0.82)",
    fontWeight: 600,
    lineStyle: {},
    tokenStroke: {
      textShadow: "0 3px 16px rgba(0,0,0,0.6)",
    } satisfies React.CSSProperties,
    spokenOpacity: 0.92,
  },
} as const satisfies Record<CaptionStyle["preset"], Omit<ResolvedCaptionStyle, never>>;

export const resolveCaptionStyle = (
  style: CaptionStyle,
  outputWidth: number,
): ResolvedCaptionStyle => {
  const preset = PRESETS[style.preset];
  const scale = outputWidth / 1080;
  return {
    ...preset,
    fontSizePx: Math.round((style.fontSizePx ?? preset.fontSizePx) * scale),
    uppercase: style.uppercase ?? preset.uppercase,
    highlightColor: style.highlightColor ?? preset.highlightColor,
  };
};

export const captionFontFamily = FONT_FAMILY;
