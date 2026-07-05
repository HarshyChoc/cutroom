import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Captions stay in a clean heavy sans. Hook/callout overlays use a display
// face so they feel distinct from spoken karaoke text.
const { fontFamily } = loadInter("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const { fontFamily: displayFontFamily } = loadAnton("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const FONT_FAMILY = fontFamily;
export const DISPLAY_FONT_FAMILY = displayFontFamily;
