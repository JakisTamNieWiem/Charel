import { type DesktopUnwatchFn, getDesktopApi } from "@/lib/desktop";
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
	const desktop = getDesktopApi();
	if (!desktop) {
		return;
	}

	await desktop.fs.mkdirAppData(CUSTOM_THEMES_DIR);
}

async function loadThemeFilesFromDirectory() {
	const desktop = getDesktopApi();
	if (!desktop) {
		return [];
	}

	const entries = await desktop.fs.readAppDataDir(CUSTOM_THEMES_DIR);

	const themes = await Promise.all(
		entries
			.filter((entry) => entry.isFile && entry.name.endsWith(".json"))
			.filter((entry) => entry.name !== "custom-themes.json")
			.map(async (entry) => {
				const contents = await desktop.fs.readAppDataTextFile(
					`${CUSTOM_THEMES_DIR}/${entry.name}`,
				);

				return parseThemePayload(contents);
			}),
	);

	return sortThemes(
		themes.filter((theme): theme is StoredCustomTheme => theme !== null),
	);
}

async function writeSeparateThemeFiles(themes: StoredCustomTheme[]) {
	const desktop = getDesktopApi();
	if (!desktop) {
		return;
	}

	await ensureThemesDirectory();

	const existingEntries = await desktop.fs.readAppDataDir(CUSTOM_THEMES_DIR);

	await Promise.all(
		existingEntries
			.filter((entry) => entry.isFile && entry.name.endsWith(".json"))
			.filter((entry) => entry.name !== "custom-themes.json")
			.filter((entry) => isManagedThemeFileName(entry.name))
			.map((entry) =>
				desktop.fs.removeAppDataPath(`${CUSTOM_THEMES_DIR}/${entry.name}`),
			),
	);

	await Promise.all(
		themes.map((theme) =>
			desktop.fs.writeAppDataTextFile(
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
			),
		),
	);
}

async function migrateLegacyCollectionFile() {
	const desktop = getDesktopApi();
	if (!desktop) {
		return [];
	}

	const collectionExists = await desktop.fs.existsAppData(
		LEGACY_COLLECTION_FILE,
	);

	if (!collectionExists) {
		return [];
	}

	const contents = await desktop.fs.readAppDataTextFile(LEGACY_COLLECTION_FILE);
	const themes = parseLegacyThemeCollection(contents);

	if (themes.length > 0) {
		await writeSeparateThemeFiles(themes);
	}

	await desktop.fs.removeAppDataPath(LEGACY_COLLECTION_FILE);

	return themes;
}

export function loadLegacyCustomThemes() {
	return readLegacyThemes();
}

export async function loadStoredCustomThemes(): Promise<StoredCustomTheme[]> {
	const legacyThemes = sortThemes(readLegacyThemes());

	if (!getDesktopApi()) {
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

	if (!getDesktopApi()) {
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
): Promise<DesktopUnwatchFn | null> {
	const desktop = getDesktopApi();

	if (!desktop) {
		return null;
	}

	await ensureThemesDirectory();

	return desktop.fs.watchAppDataPath(CUSTOM_THEMES_DIR, (event) => {
		if (
			event.paths.length === 0 ||
			event.paths.some(
				(path) =>
					path.endsWith(".json") ||
					path.endsWith(`/${CUSTOM_THEMES_DIR}`) ||
					path.endsWith(`\\${CUSTOM_THEMES_DIR}`),
			)
		) {
			void onChange();
		}
	});
}

export async function openCustomThemesFolder() {
	const desktop = getDesktopApi();

	if (!desktop) {
		throw new Error(
			"Custom theme folders are only available in the desktop app.",
		);
	}

	await ensureThemesDirectory();

	const absoluteThemesDir = await desktop.path.join(
		await desktop.path.appDataDir(),
		CUSTOM_THEMES_DIR,
	);
	await desktop.opener.openPath(absoluteThemesDir);

	return absoluteThemesDir;
}
