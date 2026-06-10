import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { contentUrl } from "../../shared/media-url";
import type { Edit, Segment } from "../../shared/schemas/edit";
import { framesToMs, msToFrames } from "../../shared/time";
import {
  computeZoom,
  containLayout,
  coverLayout,
  IDENTITY_ZOOM,
  type CoverLayout,
} from "./transform";

const layoutStyle = (layout: CoverLayout): React.CSSProperties => ({
  position: "absolute",
  width: `${layout.widthPct}%`,
  height: `${layout.heightPct}%`,
  left: `${layout.leftPct}%`,
  top: `${layout.topPct}%`,
});

/** One kept range of the source: trim, speed, reframe crop, zoom/punch-in. */
export const SegmentVideo: React.FC<{
  edit: Edit;
  segment: Segment;
  mediaBaseUrl: string;
}> = ({ edit, segment, mediaBaseUrl }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const src = contentUrl(mediaBaseUrl, edit.source.relPath);
  const sourceAspect = edit.source.width / edit.source.height;
  const outputAspect = edit.output.width / edit.output.height;
  const reframeXPct = segment.reframe?.xPct ?? edit.reframe.xPct;

  const zoom = segment.transform
    ? computeZoom(segment.transform, framesToMs(frame, fps))
    : IDENTITY_ZOOM;
  const zoomStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `translate(${(zoom.panXPct / 100) * width}px, ${(zoom.panYPct / 100) * height}px) scale(${zoom.scale})`,
  };

  const video = (
    <OffthreadVideo
      src={src}
      trimBefore={msToFrames(segment.sourceInMs, fps)}
      trimAfter={msToFrames(segment.sourceOutMs, fps)}
      playbackRate={segment.speed}
      // Remotion clamps audio gain at 1.
      volume={Math.min(1, segment.volume)}
      style={layoutStyle(coverLayout(sourceAspect, outputAspect, reframeXPct))}
    />
  );

  if (edit.reframe.mode === "fit-blur") {
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div style={zoomStyle}>
          <OffthreadVideo
            src={src}
            trimBefore={msToFrames(segment.sourceInMs, fps)}
            trimAfter={msToFrames(segment.sourceOutMs, fps)}
            playbackRate={segment.speed}
            muted
            style={{
              ...layoutStyle(coverLayout(sourceAspect, outputAspect, 0)),
              filter: "blur(40px) brightness(0.6)",
            }}
          />
          <OffthreadVideo
            src={src}
            trimBefore={msToFrames(segment.sourceInMs, fps)}
            trimAfter={msToFrames(segment.sourceOutMs, fps)}
            playbackRate={segment.speed}
            volume={Math.min(1, segment.volume)}
            style={layoutStyle(containLayout(sourceAspect, outputAspect))}
          />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={zoomStyle}>{video}</div>
    </AbsoluteFill>
  );
};
