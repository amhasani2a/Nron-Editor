const { defineConfig } = require("@playwright/test");
const fs = require("node:fs");
const localChromium =
  process.env.NRON_CHROMIUM_PATH ||
  (fs.existsSync("/usr/local/bin/chromium")
    ? "/usr/local/bin/chromium"
    : undefined);
module.exports = defineConfig({
  testDir: "tests/ui",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4318",
    launchOptions: {
      ...(!process.env.CI && localChromium
        ? { executablePath: localChromium }
        : {}),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "python3 -m http.server 4318 --directory src",
    url: "http://127.0.0.1:4318",
    reuseExistingServer: true,
  },
  reporter: [["list"], ["json", { outputFile: "test-results/ui.json" }]],
});
