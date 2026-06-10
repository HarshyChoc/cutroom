import { ZodError } from "zod";
import * as log from "./log";

/**
 * Error with a plain-English hint about what to do next. Throw these from
 * anywhere; the CLI's top-level handler renders them nicely.
 */
export class EditorError extends Error {
  readonly hint: string | null;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "EditorError";
    this.hint = hint ?? null;
  }
}

const formatZodError = (err: ZodError): string =>
  err.issues
    .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

/** Top-level CLI error handler: print friendly message + hint, exit 1. */
export const handleFatal = (err: unknown): never => {
  console.error("");
  if (err instanceof EditorError) {
    log.fail(err.message);
    if (err.hint) {
      log.hint(err.hint);
    }
  } else if (err instanceof ZodError) {
    log.fail("A data file did not match its expected format:");
    console.error(formatZodError(err));
    log.hint(
      "The file was probably hand-edited. Fix the fields listed above, or re-run the step that generates it.",
    );
  } else if (err instanceof Error) {
    log.fail(err.message);
    if (err.stack) {
      console.error(log.dim(err.stack.split("\n").slice(1, 5).join("\n")));
    }
    log.hint(
      "Unexpected error. If this keeps happening, copy the message above into the chat so Claude can investigate.",
    );
  } else {
    log.fail(String(err));
  }
  process.exit(1);
};
