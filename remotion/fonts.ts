import { loadFont } from "@remotion/google-fonts/Inter";

// One font family for everything (captions, overlays) keeps renders fast and
// the look consistent. Weights cover body → heavy caption text.
const { fontFamily } = loadFont("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

export const FONT_FAMILY = fontFamily;
