import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Local worktrees and capture probes are not part of the maintained suite.
  // The synthwave score checks assert on every event of 72 songs, well past the 5 s default.
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
});
