import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Local worktrees and capture probes are not part of the maintained suite.
  test: { include: ['tests/**/*.test.ts'] },
});
