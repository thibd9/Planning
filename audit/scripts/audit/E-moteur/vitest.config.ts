import { defineConfig } from 'vitest/config';
export default defineConfig({
  cacheDir: '/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/E-moteur/.vite-cache',
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 600000, hookTimeout: 600000, reporters: ['verbose'] },
});
