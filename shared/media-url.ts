// Pure URL builder for content/-relative media paths. Used by both the node
// scripts and the Remotion components (browser bundle) so encoding rules
// never drift apart — repo paths contain spaces, so every part is encoded.

export const contentUrl = (baseUrl: string, relPath: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/${relPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
