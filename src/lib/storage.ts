import {
	BaseDirectory,
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { GraphSnapshot } from "@/types/types";

const FILE_NAME = "graph-data.json";

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function isNullableString(value: unknown): value is string | null {
	return typeof value === "string" || value === null;
}

function isCharacter(value: unknown) {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.description === "string" &&
		isNullableString(value.avatar) &&
		isNullableString(value.groupId) &&
		typeof value.ownerId === "string" &&
		(value.phoneNumber === undefined || typeof value.phoneNumber === "string")
	);
}

function isRelationshipType(value: unknown) {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.label === "string" &&
		typeof value.color === "string" &&
		typeof value.description === "string" &&
		typeof value.value === "number" &&
		Number.isFinite(value.value)
	);
}

function isRelationship(value: unknown) {
	return (
		isRecord(value) &&
		typeof value.fromId === "string" &&
		typeof value.toId === "string" &&
		typeof value.typeId === "string" &&
		typeof value.description === "string" &&
		(value.value === null ||
			(typeof value.value === "number" && Number.isFinite(value.value)))
	);
}

function isGroup(value: unknown) {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.color === "string"
	);
}

export function isDesktopTauri() {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function parseGraphSnapshot(value: unknown): GraphSnapshot | null {
	if (!isRecord(value)) return null;
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
	if (
		!data.characters.every(isCharacter) ||
		!data.relationshipTypes.every(isRelationshipType) ||
		!data.relationships.every(isRelationship) ||
		!data.groups.every(isGroup)
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
