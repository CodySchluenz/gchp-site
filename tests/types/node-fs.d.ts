// Minimal declarations for the Node builtins our tests use.
// We deliberately do not add @types/node: the project's dependency set is
// frozen, and vitest runs tests on real Node where these APIs exist.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
}
