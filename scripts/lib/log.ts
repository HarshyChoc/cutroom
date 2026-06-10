// Friendly console output. The audience is Claude operating on behalf of a
// non-engineer, so messages favor plain English over terse codes.

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

export const step = (msg: string): void => {
  console.log(`\n${C.bold}${C.cyan}▸ ${msg}${C.reset}`);
};

export const ok = (msg: string): void => {
  console.log(`${C.green}✓${C.reset} ${msg}`);
};

export const info = (msg: string): void => {
  console.log(`  ${msg}`);
};

export const warn = (msg: string): void => {
  console.log(`${C.yellow}! ${msg}${C.reset}`);
};

export const fail = (msg: string): void => {
  console.error(`${C.red}✗ ${msg}${C.reset}`);
};

export const hint = (msg: string): void => {
  console.log(`${C.dim}  → ${msg}${C.reset}`);
};

export const heading = (msg: string): void => {
  console.log(`${C.bold}${msg}${C.reset}`);
};

export const dim = (msg: string): string => `${C.dim}${msg}${C.reset}`;
