// Pure time conversion helpers. Milliseconds are the canonical unit everywhere
// in this repo; frames exist only at the Remotion boundary.

export const msToFrames = (ms: number, fps: number): number =>
  Math.round((ms / 1000) * fps);

export const framesToMs = (frames: number, fps: number): number =>
  Math.round((frames / fps) * 1000);

export const formatMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
