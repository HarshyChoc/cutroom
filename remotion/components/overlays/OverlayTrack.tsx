import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import type { Overlay } from "../../../shared/schemas/edit";
import { msToFrames } from "../../../shared/time";
import { TextOverlay } from "./TextOverlay";
import { TitleCard } from "./TitleCard";

export const OverlayTrack: React.FC<{ overlays: readonly Overlay[] }> = ({
  overlays,
}) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {overlays.map((overlay, i) => (
        <Sequence
          key={`overlay-${i}`}
          name={`overlay ${overlay.type}`}
          from={msToFrames(overlay.startMs, fps)}
          durationInFrames={Math.max(
            1,
            msToFrames(overlay.endMs - overlay.startMs, fps),
          )}
        >
          {overlay.type === "title-card" ? (
            <TitleCard overlay={overlay} />
          ) : (
            <TextOverlay overlay={overlay} />
          )}
        </Sequence>
      ))}
    </>
  );
};
