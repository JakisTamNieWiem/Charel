// src/lib/storage.ts

import {
	BaseDirectory,
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Character, Group, Relationship, RelationshipType } from "@/types";

const FILE_NAME = "graph-data.json";

export interface JsonData {
	version: string;
	characters: Character[];
	relationshipTypes: RelationshipType[];
	relationships: Relationship[];
	groups: Group[];
}

export async function saveToDisk(data: JsonData) {
	try {
		// 1. Check if the AppData folder for our app exists, if not, create it
		const dirExists = await exists("", { baseDir: BaseDirectory.AppData });
		if (!dirExists) {
			await mkdir("", { baseDir: BaseDirectory.AppData });
		}

		// 2. Write the JSON file
		await writeTextFile(FILE_NAME, JSON.stringify(data, null, 2), {
			baseDir: BaseDirectory.AppData,
		});
	} catch (error) {
		console.error("Failed to save data to disk:", error);
	}
}

export async function loadFromDisk() {
	try {
		// 1. Check if the file exists
		const fileExists = await exists(FILE_NAME, {
			baseDir: BaseDirectory.AppData,
		});
		if (!fileExists) {
			return null; // No saved data yet
		}

		// 2. Read and parse the file
		const contents = await readTextFile(FILE_NAME, {
			baseDir: BaseDirectory.AppData,
		});
		return JSON.parse(contents);
	} catch (error) {
		console.error("Failed to load data from disk:", error);
		return null;
	}
}
