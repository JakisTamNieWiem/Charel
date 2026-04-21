// src/lib/storage.ts

import { getDesktopApi } from "@/lib/desktop";
import type {
	Character,
	Group,
	Relationship,
	RelationshipType,
} from "@/types/types";

const FILE_NAME = "graph-data.json";
const LOCAL_STORAGE_KEY = "charel-graph-data";

export interface JsonData {
	version: string;
	characters: Character[];
	relationshipTypes: RelationshipType[];
	relationships: Relationship[];
	groups: Group[];
}

export async function saveToDisk(data: JsonData) {
	try {
		const desktop = getDesktopApi();

		if (desktop) {
			const dirExists = await desktop.fs.existsAppData("");
			if (!dirExists) {
				await desktop.fs.mkdirAppData("");
			}

			await desktop.fs.writeAppDataTextFile(
				FILE_NAME,
				JSON.stringify(data, null, 2),
			);
			return;
		}

		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
	} catch (error) {
		console.error("Failed to save data to disk:", error);
	}
}

export async function loadFromDisk() {
	try {
		const desktop = getDesktopApi();

		if (desktop) {
			const fileExists = await desktop.fs.existsAppData(FILE_NAME);
			if (!fileExists) {
				return null;
			}

			const contents = await desktop.fs.readAppDataTextFile(FILE_NAME);
			return JSON.parse(contents);
		}

		const contents = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (!contents) {
			return null;
		}
		return JSON.parse(contents);
	} catch (error) {
		console.error("Failed to load data from disk:", error);
		return null;
	}
}
