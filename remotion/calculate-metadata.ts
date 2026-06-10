import type { CalculateMetadataFunction } from "remotion";
import { outputDurationMs } from "../shared/edit-helpers";
import { msToFrames } from "../shared/time";
import type { RendererProps } from "./props";

/** Duration/fps/size are DERIVED from the EDL — single source of truth. */
export const calculateEditMetadata: CalculateMetadataFunction<RendererProps> = ({
  props,
}) => {
  const { edit } = props;
  return {
    durationInFrames: Math.max(1, msToFrames(outputDurationMs(edit), edit.output.fps)),
    fps: edit.output.fps,
    width: edit.output.width,
    height: edit.output.height,
  };
};
