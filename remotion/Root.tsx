import React from "react";
import { Composition } from "remotion";
import { COMPOSITION_ID } from "../shared/constants";
import { calculateEditMetadata } from "./calculate-metadata";
import { EditRenderer } from "./EditRenderer";
import { demoProps, rendererPropsSchema } from "./props";

export const Root: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={EditRenderer}
    schema={rendererPropsSchema}
    defaultProps={demoProps()}
    // Real values come from calculateMetadata (derived from the edit).
    durationInFrames={120}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={calculateEditMetadata}
  />
);
