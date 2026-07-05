import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Overlay } from "../../../shared/schemas/edit";
import { DISPLAY_FONT_FAMILY, FONT_FAMILY } from "../../fonts";

type TextOverlayData = Extract<Overlay, { type: "text" }>;

const PRESET_STYLES = {
  hook: (scale: number): React.CSSProperties => ({
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: 94 * scale,
    fontWeight: 400,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0,
    WebkitTextStroke: "11px rgba(0,0,0,0.92)",
    paintOrder: "stroke fill",
    textShadow: "0 8px 30px rgba(0,0,0,0.65)",
  }),
  headline: (scale: number): React.CSSProperties => ({
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: 84 * scale,
    fontWeight: 400,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0,
    WebkitTextStroke: "10px rgba(0,0,0,0.9)",
    paintOrder: "stroke fill",
    textShadow: "0 5px 24px rgba(0,0,0,0.55)",
  }),
  callout: (scale: number): React.CSSProperties => ({
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: 72 * scale,
    fontWeight: 400,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0,
    WebkitTextStroke: "9px rgba(0,0,0,0.9)",
    paintOrder: "stroke fill",
    textShadow: "0 5px 24px rgba(0,0,0,0.55)",
  }),
  context: (scale: number): React.CSSProperties => ({
    fontSize: 40 * scale,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.68)",
    padding: `${10 * scale}px ${24 * scale}px`,
    borderRadius: 12 * scale,
  }),
  sticker: (scale: number): React.CSSProperties => ({
    fontSize: 48 * scale,
    fontWeight: 800,
    color: "#0c0c0f",
    backgroundColor: "#FFFFFF",
    padding: `${14 * scale}px ${30 * scale}px`,
    borderRadius: 18 * scale,
    boxShadow: "0 10px 36px rgba(0,0,0,0.4)",
  }),
} as const;

const PRESET_ROTATION: Record<TextOverlayData["preset"], string> = {
  hook: "",
  headline: "",
  callout: "",
  context: "",
  sticker: " rotate(-2deg)",
};

/** Positioned text over the video (hook / callout / context / sticker). */
export const TextOverlay: React.FC<{ overlay: TextOverlayData }> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const scale = width / 1080;
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${overlay.xPct}%`,
          top: `${overlay.yPct}%`,
          transform: `translate(-50%, -50%) translateY(${(1 - enter) * 26 * scale}px)${PRESET_ROTATION[overlay.preset]}`,
          opacity: enter,
          maxWidth: "88%",
          textAlign: "center",
          fontFamily: FONT_FAMILY,
          lineHeight: 1.05,
          ...PRESET_STYLES[overlay.preset](scale),
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  );
};
