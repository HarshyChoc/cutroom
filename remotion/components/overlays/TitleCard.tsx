import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Overlay } from "../../../shared/schemas/edit";
import { FONT_FAMILY } from "../../fonts";

type TitleCardOverlay = Extract<Overlay, { type: "title-card" }>;

const EXIT_FRAMES = 8;

/** Full-bleed card: hook (over video), chapter (lower third), endcard (solid). */
export const TitleCard: React.FC<{ overlay: TitleCardOverlay }> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const scale = width / 1080;

  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - EXIT_FRAMES), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const isEndcard = overlay.preset === "endcard";
  const isChapter = overlay.preset === "chapter";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: isEndcard ? "#0c0c0f" : "rgba(0,0,0,0.45)",
        opacity: exit,
        justifyContent: isChapter ? "flex-end" : "center",
        alignItems: isChapter ? "flex-start" : "center",
        padding: isChapter ? `${120 * scale}px` : `${64 * scale}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          transform: `translateY(${(1 - enter) * 40 * scale}px)`,
          opacity: enter,
          textAlign: isChapter ? "left" : "center",
          maxWidth: "88%",
        }}
      >
        {isChapter ? (
          <div
            style={{
              width: 120 * scale,
              height: 10 * scale,
              backgroundColor: "#FFD400",
              borderRadius: 5 * scale,
              marginBottom: 24 * scale,
            }}
          />
        ) : null}
        <div
          style={{
            fontSize: (isChapter ? 60 : 84) * scale,
            fontWeight: 800,
            color: "#FFFFFF",
            textTransform: "uppercase",
            lineHeight: 1.08,
            textShadow: "0 6px 30px rgba(0,0,0,0.6)",
          }}
        >
          {overlay.title}
        </div>
        {overlay.subtitle ? (
          <div
            style={{
              marginTop: 22 * scale,
              fontSize: 42 * scale,
              fontWeight: 600,
              color: isEndcard ? "#FFD400" : "rgba(255,255,255,0.88)",
              lineHeight: 1.25,
            }}
          >
            {overlay.subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
