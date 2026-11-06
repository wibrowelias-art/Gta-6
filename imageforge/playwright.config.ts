import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/imageforge_test";

/** Isolated e2e environment: test DB, stub provider only (no API keys), local storage. */
export const e2eEnv = {
  DATABASE_URL: TEST_DB,
  BETTER_AUTH_SECRET: "e2e-Q7vN2kLw9xTzR4bY8mHc3fJp6sDg1aUe",
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
  DEV_BOOTSTRAP_EMAIL: "dev@e2e.local",
  DEV_BOOTSTRAP_PASSWORD: "dev-password-e2e",
  DEV_PIN: "135790",
  CRON_SECRET: "e2e-cron",
  IMAGEFORGE_STORAGE_DIR: ".data/e2e-blobs",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  BLOB_READ_WRITE_TOKEN: "",
  RESEND_API_KEY: "",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", ...devices["Desktop Chrome"] },
  webServer: {
    // Reset the test DB (migrate + truncate + bootstrap developer), then serve the production build.
    command: `npx tsx --conditions=react-server scripts/e2e-reset.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: e2eEnv,
  },
});
