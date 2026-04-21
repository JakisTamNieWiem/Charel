import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const host = process.env.VITE_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", { target: "19" }]],
			},
		}),
		tsconfigPaths(),
		tailwindcss(),
	],

	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: ["**/src-electron/**", "**/src-tauri/**"],
		},
	},
}));
