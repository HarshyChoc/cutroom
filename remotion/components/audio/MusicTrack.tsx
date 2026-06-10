import React, { useMemo } from "react";
import { Audio, useVideoConfig } from "remotion";
import { outputDurationMs } from "../../../shared/edit-helpers";
import { contentUrl } from "../../../shared/media-url";
import type { Edit } from "../../../shared/schemas/edit";
import { framesToMs, msToFrames } from "../../../shared/time";
import { duckedMusicVolume, speechIntervals } from "./ducking";

/** Looping music bed with end fade-out and speech-aware ducking. */
export const MusicTrack: React.FC<{
  edit: Edit;
  mediaBaseUrl: string;
}> = ({ edit, mediaBaseUrl }) => {
  const { fps } = useVideoConfig();
  const music = edit.music;
  const totalMs = outputDurationMs(edit);
  const intervals = useMemo(
    () => (music ? speechIntervals(edit.captions.pages) : []),
    [music, edit.captions.pages],
  );

  if (!music) {
    return null;
  }

  const volumeAt = (frame: number): number => {
    const tMs = framesToMs(frame, fps);
    const fade =
      music.fadeOutMs > 0
        ? Math.min(1, Math.max(0, (totalMs - tMs) / music.fadeOutMs))
        : 1;
    const ducked = duckedMusicVolume(tMs, music.volume, intervals, music.ducking);
    return Math.max(0, Math.min(1, ducked * fade));
  };

  return (
    <Audio
      src={contentUrl(mediaBaseUrl, music.src)}
      loop
      trimBefore={msToFrames(music.offsetMs, fps)}
      volume={volumeAt}
    />
  );
};
