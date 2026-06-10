import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import type { Edit } from "../../../shared/schemas/edit";
import { msToFrames } from "../../../shared/time";
import { CaptionPage } from "./CaptionPage";
import { resolveCaptionStyle } from "./caption-styles";

export const CaptionTrack: React.FC<{ captions: Edit["captions"] }> = ({
  captions,
}) => {
  const { width } = useVideoConfig();
  const { fps } = useVideoConfig();
  const resolved = resolveCaptionStyle(captions.style, width);

  return (
    <>
      {captions.pages.map((page, i) => (
        <Sequence
          key={`page-${i}`}
          name={`caption "${page.tokens[0]?.text.trim() ?? ""}…"`}
          from={msToFrames(page.startMs, fps)}
          durationInFrames={Math.max(1, msToFrames(page.endMs - page.startMs, fps))}
        >
          <CaptionPage page={page} style={resolved} yPct={captions.style.yPct} />
        </Sequence>
      ))}
    </>
  );
};
