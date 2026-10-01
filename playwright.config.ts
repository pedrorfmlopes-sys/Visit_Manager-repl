import { defineConfig } from "@playwright/test";

const testPort = 5001;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    headless: true,
  },
  webServer: {
    command:
      `cmd /c node --env-file=.env --import tsx -e "process.env.NODE_ENV='development'; process.env.ENABLE_E2E_AUTH_HELPERS='true'; process.env.PORT='${testPort}'; import('./server/index.ts');"`,
    url: `http://127.0.0.1:${testPort}/api/auth/me`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
