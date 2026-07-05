import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { contentUrl } from "../../../shared/media-url";
import type { Overlay } from "../../../shared/schemas/edit";

type ImageOverlayData = Extract<Overlay, { type: "image" }>;

const clampPanPct = (panPct: number, scale: number): number => {
  const maxPanPct = Math.max(0, (scale - 1) * 50);
  return Math.min(maxPanPct, Math.max(-maxPanPct, panPct));
};

/** Full-bleed moving image B-roll. Captions render above this track. */
export const ImageOverlay: React.FC<{
  overlay: ImageOverlayData;
  mediaBaseUrl: string;
}> = ({ overlay, mediaBaseUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = durationInFrames <= 1 ? 1 : frame / (durationInFrames - 1);
  const opacity = interpolate(
    frame,
    [0, 8, Math.max(8, durationInFrames - 8), durationInFrames],
    [0, overlay.opacity, overlay.opacity, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(
    progress,
    [0, 1],
    [overlay.motion.fromScale, overlay.motion.toScale],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const xPct = clampPanPct(
    interpolate(
      progress,
      [0, 1],
      [overlay.motion.fromXPct, overlay.motion.toXPct],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
    scale,
  );
  const yPct = clampPanPct(
    interpolate(
      progress,
      [0, 1],
      [overlay.motion.fromYPct, overlay.motion.toYPct],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
    scale,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity, overflow: "hidden" }}>
      <Img
        src={contentUrl(mediaBaseUrl, overlay.src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: overlay.fit,
          transform: `translate(${xPct}%, ${yPct}%) scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};
