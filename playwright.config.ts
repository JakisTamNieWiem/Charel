import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./src/tests/e2e",
	timeout: 30_000,
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "on-first-retry",
	},
	webServer: {
		command: "bun run dev --host 127.0.0.1",
		url: "http://127.0.0.1:1420",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:1420" },
		},
	],
});
