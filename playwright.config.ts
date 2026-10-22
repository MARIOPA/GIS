import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5181",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command:
      "TERRAIN_DIR=/tmp/torrents-e2e-no-terrain PORT=5181 DATA_DIR=/tmp/torrents-e2e-data npm run dev",
    url: "http://127.0.0.1:5181/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
