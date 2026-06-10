import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { EditorError } from "./errors";
import { CONTENT_DIR } from "./paths";

// Tiny static file server rooted at content/, with HTTP Range support so
// Remotion can seek inside videos. This exists because Remotion's bundler
// copies the whole publicDir into every render bundle — footage must be
// served over HTTP, never bundled. Binds to localhost only.

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export interface MediaServer {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
}

const handleRequest = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> => {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
  const filePath = path.normalize(path.join(CONTENT_DIR, urlPath));
  if (!filePath.startsWith(CONTENT_DIR + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  let size: number;
  try {
    const st = await stat(filePath);
    if (!st.isFile()) {
      throw new Error("not a file");
    }
    size = st.size;
  } catch {
    res.writeHead(404).end("Not found");
    return;
  }

  const contentType = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!match || Number.isNaN(start) || start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
      return;
    }
    res.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    });
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
  });
  createReadStream(filePath).pipe(res);
};

/** Start the server. Port 0 (default) picks a free ephemeral port. */
export const startMediaServer = (port = 0): Promise<MediaServer> => {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end();
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new EditorError(
            `Port ${port} is already in use.`,
            "Is another `editor studio` already running? Close it, or change mediaServerPort in editor.config.json.",
          ),
        );
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            // Render workers keep sockets open; don't let that block exit.
            server.closeAllConnections();
          }),
      });
    });
  });
};

/** Build the URL the composition uses for a content/-relative path. */
export const contentUrl = (baseUrl: string, relPath: string): string =>
  `${baseUrl}/${relPath.split("/").map(encodeURIComponent).join("/")}`;
