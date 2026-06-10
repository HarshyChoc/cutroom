import React from "react";
import { AbsoluteFill } from "remotion";
import { MusicTrack } from "./components/audio/MusicTrack";
import { CaptionTrack } from "./components/captions/CaptionTrack";
import { OverlayTrack } from "./components/overlays/OverlayTrack";
import { VideoTimeline } from "./components/VideoTimeline";
import type { RendererProps } from "./props";

/**
 * The one generic composition. Layer order (bottom → top):
 * video timeline → overlays → captions. Music is a parallel audio track.
 */
export const EditRenderer: React.FC<RendererProps> = ({ edit, mediaBaseUrl }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <VideoTimeline edit={edit} mediaBaseUrl={mediaBaseUrl} />
    <OverlayTrack overlays={edit.overlays} />
    {edit.captions.enabled ? <CaptionTrack captions={edit.captions} /> : null}
    <MusicTrack edit={edit} mediaBaseUrl={mediaBaseUrl} />
  </AbsoluteFill>
);
