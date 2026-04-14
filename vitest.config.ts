import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", { target: "19" }]],
			},
		}),
		tsconfigPaths(),
		tailwindcss(),
	],
	test: {
		include: ["src/tests/**/*.test.{ts,tsx}"],
		environment: "jsdom",
		setupFiles: ["./src/tests/setup.ts"],
		css: true,
		restoreMocks: true,
		clearMocks: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
		},
	},
});
