import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import tsconfigPaths from "vite-tsconfig-paths";

const rendererPlugins = [
	react({
		babel: {
			plugins: [["babel-plugin-react-compiler", { target: "19" }]],
		},
	}),
	tsconfigPaths(),
	tailwindcss(),
];

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		build: {
			outDir: "dist-electron/main",
			rollupOptions: {
				input: "src-electron/main.ts",
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		build: {
			outDir: "dist-electron/preload",
			rollupOptions: {
				input: "src-electron/preload.ts",
			},
		},
	},
	renderer: {
		root: ".",
		plugins: rendererPlugins,
		build: {
			outDir: "dist-electron/renderer",
			rollupOptions: {
				input: "index.html",
			},
		},
		clearScreen: false,
		server: {
			port: 1420,
			strictPort: true,
		},
	},
});
