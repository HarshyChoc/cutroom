import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CaptionPage as CaptionPageData } from "../../../shared/schemas/edit";
import { framesToMs, msToFrames } from "../../../shared/time";
import { captionFontFamily, type ResolvedCaptionStyle } from "./caption-styles";

/** One on-screen caption "page" with karaoke word highlighting. */
export const CaptionPage: React.FC<{
  page: CaptionPageData;
  style: ResolvedCaptionStyle;
  yPct: number;
}> = ({ page, style, yPct }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Frame is relative to this page's <Sequence>; convert to output-clock ms.
  const tMs = page.startMs + framesToMs(frame, fps);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: `${yPct}%`,
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxWidth: "84%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          columnGap: "0.28em",
          rowGap: "0.1em",
          fontFamily: captionFontFamily,
          fontSize: style.fontSizePx,
          fontWeight: style.fontWeight,
          lineHeight: 1.18,
          textAlign: "center",
          ...style.lineStyle,
        }}
      >
        {page.tokens.map((token, i) => {
          const active = tMs >= token.fromMs && tMs < token.toMs;
          const spoken = tMs >= token.toMs;
          if (!active && !spoken) {
            return null;
          }
          const popFrames = frame - msToFrames(token.fromMs - page.startMs, fps);
          const pop = active
            ? 1 +
              0.07 *
                spring({
                  frame: Math.max(0, popFrames),
                  fps,
                  config: { damping: 13, stiffness: 190, mass: 0.6 },
                  durationInFrames: Math.max(4, Math.round(fps / 5)),
                })
            : 1;
          const text = style.uppercase
            ? token.text.trim().toUpperCase()
            : token.text.trim();
          return (
            <span
              key={`${token.fromMs}-${i}`}
              style={{
                color: active ? style.highlightColor : style.textColor,
                opacity: spoken ? style.spokenOpacity : active ? 1 : 0.85,
                transform: `scale(${pop})`,
                display: "inline-block",
                ...style.tokenStroke,
              }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
