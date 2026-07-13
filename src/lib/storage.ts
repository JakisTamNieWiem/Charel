import {
	BaseDirectory,
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { GraphSnapshot } from "@/types/types";

const FILE_NAME = "graph-data.json";

export function isDesktopTauri() {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function parseGraphSnapshot(value: unknown): GraphSnapshot | null {
	if (!value || typeof value !== "object") return null;
	const data = value as Record<string, unknown>;
	if (
		(data.version !== "2" && data.version !== "1.0.0") ||
		!Array.isArray(data.characters) ||
		!Array.isArray(data.relationshipTypes) ||
		!Array.isArray(data.relationships) ||
		!Array.isArray(data.groups)
	) {
		return null;
	}

	return {
		version: "2",
		characters: data.characters as GraphSnapshot["characters"],
		relationshipTypes:
			data.relationshipTypes as GraphSnapshot["relationshipTypes"],
		relationships: data.relationships as GraphSnapshot["relationships"],
		groups: data.groups as GraphSnapshot["groups"],
	};
}

export async function saveGraphBackup(data: GraphSnapshot) {
	if (!isDesktopTauri()) return;

	try {
		const dirExists = await exists("", { baseDir: BaseDirectory.AppData });
		if (!dirExists) {
			await mkdir("", { baseDir: BaseDirectory.AppData });
		}

		await writeTextFile(FILE_NAME, JSON.stringify(data, null, 2), {
			baseDir: BaseDirectory.AppData,
		});
	} catch (error) {
		console.error("Failed to save graph backup:", error);
	}
}

export async function loadGraphBackup() {
	if (!isDesktopTauri()) return null;

	try {
		const fileExists = await exists(FILE_NAME, {
			baseDir: BaseDirectory.AppData,
		});
		if (!fileExists) return null;

		const contents = await readTextFile(FILE_NAME, {
			baseDir: BaseDirectory.AppData,
		});
		return parseGraphSnapshot(JSON.parse(contents));
	} catch (error) {
		console.error("Failed to load graph backup:", error);
		return null;
	}
}
