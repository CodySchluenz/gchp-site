// Minimal declaration for the one Node builtin our tests use.
// We deliberately do not add @types/node: the project's dependency set is
// frozen, and vitest runs tests on real Node where this API exists.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
}
