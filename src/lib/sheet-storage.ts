import {
	BaseDirectory,
	exists,
	mkdir,
	readTextFile,
	remove,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import type {
	SheetDocument,
	SheetIndexEntry,
	SheetIndexFile,
} from "@/types/sheets";
import { createDefaultSheetPage } from "@/types/sheets";

const SHEETS_DIR = "sheets";
const INDEX_FILE = `${SHEETS_DIR}/index.json`;

const EMPTY_INDEX: SheetIndexFile = {
	version: "1",
	activeSheetId: null,
	sheets: [],
};

async function ensureSheetsDir() {
	const dirExists = await exists(SHEETS_DIR, {
		baseDir: BaseDirectory.AppData,
	});
	if (!dirExists) {
		await mkdir(SHEETS_DIR, {
			baseDir: BaseDirectory.AppData,
			recursive: true,
		});
	}
}

export function getSheetFileName(id: string) {
	return `${id}.json`;
}

function getSheetPath(fileName: string) {
	return `${SHEETS_DIR}/${fileName}`;
}

export async function loadSheetIndex(): Promise<SheetIndexFile> {
	await ensureSheetsDir();
	const indexExists = await exists(INDEX_FILE, {
		baseDir: BaseDirectory.AppData,
	});
	if (!indexExists) {
		await writeTextFile(INDEX_FILE, JSON.stringify(EMPTY_INDEX, null, 2), {
			baseDir: BaseDirectory.AppData,
		});
		return EMPTY_INDEX;
	}

	try {
		const raw = await readTextFile(INDEX_FILE, {
			baseDir: BaseDirectory.AppData,
		});
		const parsed = JSON.parse(raw) as Partial<SheetIndexFile>;
		return {
			version: "1",
			activeSheetId: parsed.activeSheetId ?? null,
			sheets: Array.isArray(parsed.sheets) ? parsed.sheets : [],
		};
	} catch (error) {
		console.error("Failed to load sheet index", error);
		return EMPTY_INDEX;
	}
}

export async function saveSheetIndex(index: SheetIndexFile) {
	await ensureSheetsDir();
	await writeTextFile(INDEX_FILE, JSON.stringify(index, null, 2), {
		baseDir: BaseDirectory.AppData,
	});
}

export async function loadSheetDocument(
	fileName: string,
): Promise<SheetDocument | null> {
	await ensureSheetsDir();
	const path = getSheetPath(fileName);
	const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
	if (!fileExists) return null;

	try {
		const raw = await readTextFile(path, { baseDir: BaseDirectory.AppData });
		const parsed = JSON.parse(raw) as
			| (SheetDocument & {
					modules?: SheetDocument["pages"][number]["modules"];
			  })
			| null;
		if (!parsed) return null;

		const legacyModules = Array.isArray(parsed.modules) ? parsed.modules : [];
		const pages =
			Array.isArray(parsed.pages) && parsed.pages.length > 0
				? parsed.pages
				: [{ ...createDefaultSheetPage(), modules: legacyModules }];

		return {
			version: "2",
			meta: parsed.meta,
			grid: parsed.grid,
			pages,
			values:
				parsed.values && typeof parsed.values === "object" ? parsed.values : {},
		};
	} catch (error) {
		console.error("Failed to load sheet document", error);
		return null;
	}
}

export async function saveSheetDocument(document: SheetDocument) {
	await ensureSheetsDir();
	const fileName = getSheetFileName(document.meta.id);
	await writeTextFile(
		getSheetPath(fileName),
		JSON.stringify(document, null, 2),
		{ baseDir: BaseDirectory.AppData },
	);
	return fileName;
}

export async function deleteSheetDocument(fileName: string) {
	const path = getSheetPath(fileName);
	const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
	if (!fileExists) return;
	await remove(path, { baseDir: BaseDirectory.AppData });
}

export function upsertSheetIndexEntry(
	entries: SheetIndexEntry[],
	entry: SheetIndexEntry,
) {
	const existing = entries.findIndex((item) => item.id === entry.id);
	if (existing === -1) {
		return [...entries, entry];
	}
	return entries.map((item, index) => (index === existing ? entry : item));
}
