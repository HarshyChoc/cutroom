import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Overlay } from "../../../shared/schemas/edit";
import { FONT_FAMILY } from "../../fonts";

type TextOverlayData = Extract<Overlay, { type: "text" }>;

const PRESET_STYLES = {
  headline: (scale: number): React.CSSProperties => ({
    fontSize: 62 * scale,
    fontWeight: 800,
    color: "#FFFFFF",
    textTransform: "uppercase",
    WebkitTextStroke: "9px rgba(0,0,0,0.9)",
    paintOrder: "stroke fill",
    textShadow: "0 5px 24px rgba(0,0,0,0.55)",
  }),
  context: (scale: number): React.CSSProperties => ({
    fontSize: 40 * scale,
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.62)",
    padding: `${10 * scale}px ${24 * scale}px`,
    borderRadius: 14 * scale,
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

/** Rotation must compose with the centering transform, not live in the
 * preset style — a preset `transform` would override positioning. */
const PRESET_ROTATION: Record<TextOverlayData["preset"], string> = {
  headline: "",
  context: "",
  sticker: " rotate(-2deg)",
};

/** Positioned text over the video (headline / context pill / sticker). */
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
          maxWidth: "86%",
          textAlign: "center",
          fontFamily: FONT_FAMILY,
          lineHeight: 1.15,
          ...PRESET_STYLES[overlay.preset](scale),
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  );
};
