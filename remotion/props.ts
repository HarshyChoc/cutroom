import { z } from "zod";
import { editSchema } from "../shared/schemas/edit";

export const rendererPropsSchema = z.object({
  edit: editSchema,
  /** Base URL of the local media server rooted at content/. */
  mediaBaseUrl: z.string(),
});

export type RendererProps = z.infer<typeof rendererPropsSchema>;

/**
 * Placeholder props so the composition registers without real footage.
 * Studio sessions launched via `editor studio <id>` replace these.
 */
export const demoProps = (): RendererProps => ({
  edit: editSchema.parse({
    version: 1,
    videoId: "demo",
    title: "Demo (open via: npm run editor -- studio <video-id>)",
    contentType: "demo",
    source: {
      relPath: "library/demo/media/mezzanine.mp4",
      durationMs: 4000,
      width: 1280,
      height: 720,
    },
    segments: [{ id: "seg-01", sourceInMs: 0, sourceOutMs: 4000 }],
  }),
  mediaBaseUrl: "http://127.0.0.1:7878",
});
