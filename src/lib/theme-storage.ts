import { isTauri } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
	BaseDirectory,
	exists,
	mkdir,
	readDir,
	readTextFile,
	remove,
	type UnwatchFn,
	watch,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import {
	normalizeCustomThemeCss,
	normalizeThemeValues,
	parseThemeCss,
	type ThemeValues,
} from "@/lib/theme-editor";

export type StoredCustomTheme = {
	id: string;
	name: string;
	values: ThemeValues;
};

type ThemeFilePayload = {
	id: string;
	name: string;
	values: ThemeValues;
};

const LEGACY_CUSTOM_THEMES_KEY = "app-custom-themes";
const CUSTOM_THEMES_DIR = "themes";
const LEGACY_COLLECTION_FILE = `${CUSTOM_THEMES_DIR}/custom-themes.json`;
const MANAGED_THEME_FILE_PATTERN = /^.+--[^/\\]+\.json$/i;

function isDesktopTauri() {
	return typeof window !== "undefined" && isTauri();
}

function slugifyFileName(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

function toThemeFileName(theme: Pick<StoredCustomTheme, "id" | "name">) {
	const slug =
		slugifyFileName(theme.name) || slugifyFileName(theme.id) || "theme";
	return `${slug}--${theme.id}.json`;
}

function isManagedThemeFileName(fileName: string) {
	return MANAGED_THEME_FILE_PATTERN.test(fileName);
}

function normalizeTheme(theme: StoredCustomTheme): StoredCustomTheme {
	return {
		id: theme.id,
		name: theme.name.trim() || "Custom Theme",
		values: normalizeThemeValues(theme.values),
	};
}

function parseLegacyCssTheme(theme: {
	id?: unknown;
	name?: unknown;
	css?: unknown;
}) {
	if (
		typeof theme?.id !== "string" ||
		typeof theme?.name !== "string" ||
		typeof theme?.css !== "string"
	) {
		return null;
	}

	return normalizeTheme({
		id: theme.id,
		name: theme.name,
		values: normalizeThemeValues(
			parseThemeCss(normalizeCustomThemeCss(theme.css)),
		),
	});
}

function parseJsonTheme(theme: {
	id?: unknown;
	name?: unknown;
	values?: unknown;
}) {
	if (
		typeof theme?.id !== "string" ||
		typeof theme?.name !== "string" ||
		typeof theme?.values !== "object" ||
		theme.values === null
	) {
		return null;
	}

	return normalizeTheme({
		id: theme.id,
		name: theme.name,
		values: theme.values as ThemeValues,
	});
}

function parseThemePayload(raw: string) {
	try {
		const parsed = JSON.parse(raw) as Partial<ThemeFilePayload>;

		if (
			typeof parsed?.id !== "string" ||
			typeof parsed?.name !== "string" ||
			typeof parsed?.values !== "object" ||
			parsed.values === null
		) {
			return null;
		}

		return normalizeTheme({
			id: parsed.id,
			name: parsed.name,
			values: parsed.values as ThemeValues,
		});
	} catch {
		return null;
	}
}

function parseLegacyThemeCollection(raw: string | null | undefined) {
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.map(
				(theme) =>
					parseJsonTheme(
						theme as { id?: unknown; name?: unknown; values?: unknown },
					) ??
					parseLegacyCssTheme(
						theme as { id?: unknown; name?: unknown; css?: unknown },
					),
			)
			.filter((theme): theme is StoredCustomTheme => theme !== null);
	} catch {
		return [];
	}
}

function readLegacyThemes() {
	if (typeof localStorage === "undefined") {
		return [];
	}

	return parseLegacyThemeCollection(
		localStorage.getItem(LEGACY_CUSTOM_THEMES_KEY),
	);
}

function writeLegacyThemes(themes: StoredCustomTheme[]) {
	if (typeof localStorage === "undefined") {
		return;
	}

	localStorage.setItem(LEGACY_CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

function clearLegacyThemes() {
	if (typeof localStorage === "undefined") {
		return;
	}

	localStorage.removeItem(LEGACY_CUSTOM_THEMES_KEY);
}

function sortThemes(themes: StoredCustomTheme[]) {
	return [...themes].sort((left, right) => left.name.localeCompare(right.name));
}

async function ensureThemesDirectory() {
	await mkdir(CUSTOM_THEMES_DIR, {
		baseDir: BaseDirectory.AppData,
		recursive: true,
	});
}

async function loadThemeFilesFromDirectory() {
	const entries = await readDir(CUSTOM_THEMES_DIR, {
		baseDir: BaseDirectory.AppData,
	});

	const themes = await Promise.all(
		entries
			.filter((entry) => entry.isFile && entry.name.endsWith(".json"))
			.filter((entry) => entry.name !== "custom-themes.json")
			.map(async (entry) => {
				const contents = await readTextFile(
					`${CUSTOM_THEMES_DIR}/${entry.name}`,
					{
						baseDir: BaseDirectory.AppData,
					},
				);

				return parseThemePayload(contents);
			}),
	);

	return sortThemes(
		themes.filter((theme): theme is StoredCustomTheme => theme !== null),
	);
}

async function writeSeparateThemeFiles(themes: StoredCustomTheme[]) {
	await ensureThemesDirectory();

	const existingEntries = await readDir(CUSTOM_THEMES_DIR, {
		baseDir: BaseDirectory.AppData,
	});

	await Promise.all(
		existingEntries
			.filter((entry) => entry.isFile && entry.name.endsWith(".json"))
			.filter((entry) => entry.name !== "custom-themes.json")
			.filter((entry) => isManagedThemeFileName(entry.name))
			.map((entry) =>
				remove(`${CUSTOM_THEMES_DIR}/${entry.name}`, {
					baseDir: BaseDirectory.AppData,
				}),
			),
	);

	await Promise.all(
		themes.map((theme) =>
			writeTextFile(
				`${CUSTOM_THEMES_DIR}/${toThemeFileName(theme)}`,
				JSON.stringify(
					{
						id: theme.id,
						name: theme.name,
						values: theme.values,
					} satisfies ThemeFilePayload,
					null,
					2,
				),
				{
					baseDir: BaseDirectory.AppData,
				},
			),
		),
	);
}

async function migrateLegacyCollectionFile() {
	const collectionExists = await exists(LEGACY_COLLECTION_FILE, {
		baseDir: BaseDirectory.AppData,
	});

	if (!collectionExists) {
		return [];
	}

	const contents = await readTextFile(LEGACY_COLLECTION_FILE, {
		baseDir: BaseDirectory.AppData,
	});
	const themes = parseLegacyThemeCollection(contents);

	if (themes.length > 0) {
		await writeSeparateThemeFiles(themes);
	}

	await remove(LEGACY_COLLECTION_FILE, {
		baseDir: BaseDirectory.AppData,
	});

	return themes;
}

export function loadLegacyCustomThemes() {
	return readLegacyThemes();
}

export async function loadStoredCustomThemes(): Promise<StoredCustomTheme[]> {
	const legacyThemes = sortThemes(readLegacyThemes());

	if (!isDesktopTauri()) {
		return legacyThemes;
	}

	try {
		await ensureThemesDirectory();

		const fileThemes = await loadThemeFilesFromDirectory();

		if (fileThemes.length > 0) {
			clearLegacyThemes();
			return fileThemes;
		}

		const migratedCollectionThemes = await migrateLegacyCollectionFile();

		if (migratedCollectionThemes.length > 0) {
			clearLegacyThemes();
			return sortThemes(migratedCollectionThemes);
		}

		if (legacyThemes.length > 0) {
			await saveStoredCustomThemeSet(legacyThemes);
		}

		return legacyThemes;
	} catch (error) {
		console.error("Failed to load custom themes from disk:", error);
		return legacyThemes;
	}
}

export async function saveStoredCustomThemeSet(
	themes: StoredCustomTheme[],
): Promise<StoredCustomTheme[]> {
	const normalizedThemes = sortThemes(themes.map(normalizeTheme));

	if (!isDesktopTauri()) {
		writeLegacyThemes(normalizedThemes);
		return normalizedThemes;
	}

	await writeSeparateThemeFiles(normalizedThemes);
	clearLegacyThemes();

	return normalizedThemes;
}

export async function saveStoredCustomTheme(
	theme: StoredCustomTheme,
	existingThemes: StoredCustomTheme[],
) {
	return saveStoredCustomThemeSet([
		...existingThemes.filter((existingTheme) => existingTheme.id !== theme.id),
		normalizeTheme(theme),
	]);
}

export async function watchStoredCustomThemes(
	onChange: () => void | Promise<void>,
): Promise<UnwatchFn | null> {
	if (!isDesktopTauri()) {
		return null;
	}

	await ensureThemesDirectory();

	return watch(
		CUSTOM_THEMES_DIR,
		(event) => {
			if (
				event.paths.length === 0 ||
				event.paths.some(
					(path) =>
						path.endsWith(".json") || path.endsWith(`/${CUSTOM_THEMES_DIR}`),
				)
			) {
				void onChange();
			}
		},
		{
			baseDir: BaseDirectory.AppData,
			delayMs: 150,
		},
	);
}

export async function openCustomThemesFolder() {
	if (!isDesktopTauri()) {
		throw new Error("Custom theme folders are only available in Tauri.");
	}

	await ensureThemesDirectory();

	const absoluteThemesDir = await join(await appDataDir(), CUSTOM_THEMES_DIR);
	await openPath(absoluteThemesDir);

	return absoluteThemesDir;
}
