import crypto from "node:crypto";
import path from "node:path";

// Video ids look like 2026-06-10-my-clip-name-a3f2: human-navigable (date +
// slug) and collision-safe (4 hex chars from file identity).

const MAX_SLUG_LENGTH = 40;

export const slugify = (filename: string): string => {
  const base = path.basename(filename, path.extname(filename));
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "clip";
};

export const makeVideoId = (args: {
  filename: string;
  sizeBytes: number;
  mtimeMs: number;
}): string => {
  const date = new Date(args.mtimeMs).toISOString().slice(0, 10);
  const hash = crypto
    .createHash("sha256")
    .update(`${args.filename}:${args.sizeBytes}:${Math.round(args.mtimeMs)}`)
    .digest("hex")
    .slice(0, 4);
  return `${date}-${slugify(args.filename)}-${hash}`;
};
