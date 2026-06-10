import React from "react";
import { Sequence } from "remotion";
import { segmentTimeline } from "../../shared/edit-helpers";
import type { Edit } from "../../shared/schemas/edit";
import { msToFrames } from "../../shared/time";
import { SegmentVideo } from "./SegmentVideo";

/** Lays kept segments back-to-back on the output timeline. */
export const VideoTimeline: React.FC<{
  edit: Edit;
  mediaBaseUrl: string;
}> = ({ edit, mediaBaseUrl }) => {
  const fps = edit.output.fps;
  return (
    <>
      {segmentTimeline(edit).map((entry) => (
        <Sequence
          key={entry.segment.id}
          name={`segment ${entry.segment.id}`}
          from={msToFrames(entry.outputStartMs, fps)}
          durationInFrames={Math.max(1, msToFrames(entry.outputDurationMs, fps))}
        >
          <SegmentVideo
            edit={edit}
            segment={entry.segment}
            mediaBaseUrl={mediaBaseUrl}
          />
        </Sequence>
      ))}
    </>
  );
};
