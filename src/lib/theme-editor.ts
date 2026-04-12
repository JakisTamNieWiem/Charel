import stylesSource from "@/styles.css?raw";

export type ThemeMode = "light" | "dark";
export type ThemeVariableMap = Record<string, string>;
export type ThemeValues = Record<ThemeMode, ThemeVariableMap>;
export type PartialThemeValues = Partial<
	Record<ThemeMode, Partial<ThemeVariableMap>>
>;
export type ThemeVariableGroup = {
	id: string;
	label: string;
	keys: string[];
};
export type OklchColor = {
	l: number;
	c: number;
	h: number;
};

const THEME_BLOCK_REGEX = /(:root|\.dark)\.theme-([a-z0-9-]+)\s*{([\s\S]*?)}/g;
const CSS_VARIABLE_REGEX = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
const LIGHT_BLOCK_REGEX = /:root(?:\.[a-zA-Z0-9-]+)?[^{]*{([\s\S]*?)}/;
const DARK_BLOCK_REGEX = /\.dark(?:\.[a-zA-Z0-9-]+)?[^{]*{([\s\S]*?)}/;
const PREVIEW_STYLE_ID = "theme-preview-style";

function extractCssVariables(block: string): ThemeVariableMap {
	const variables: ThemeVariableMap = {};

	for (const match of block.matchAll(CSS_VARIABLE_REGEX)) {
		variables[match[1]] = match[2].trim();
	}

	return variables;
}

function collectPresetThemes(css: string): Record<string, PartialThemeValues> {
	const themes: Record<string, PartialThemeValues> = {};

	for (const match of css.matchAll(THEME_BLOCK_REGEX)) {
		const mode: ThemeMode = match[1] === ":root" ? "light" : "dark";
		const themeId = match[2];
		const variables = extractCssVariables(match[3]);

		themes[themeId] ??= {};
		themes[themeId][mode] = variables;
	}

	return themes;
}

function collectThemeVariableKeys(css: string): string[] {
	const keys: string[] = [];

	for (const match of css.matchAll(THEME_BLOCK_REGEX)) {
		const variables = extractCssVariables(match[3]);

		for (const key of Object.keys(variables)) {
			if (!keys.includes(key)) {
				keys.push(key);
			}
		}
	}

	return keys;
}

const presetThemes = collectPresetThemes(stylesSource);

export const THEME_VARIABLE_KEYS = collectThemeVariableKeys(stylesSource);

const EMPTY_THEME_VALUES: ThemeValues = {
	light: Object.fromEntries(THEME_VARIABLE_KEYS.map((key) => [key, ""])),
	dark: Object.fromEntries(THEME_VARIABLE_KEYS.map((key) => [key, ""])),
};

function fillModeValues(
	values?: Partial<ThemeVariableMap>,
	fallback?: ThemeVariableMap,
) {
	return Object.fromEntries(
		THEME_VARIABLE_KEYS.map((key) => [key, values?.[key] ?? fallback?.[key] ?? ""]),
	);
}

const firstPresetTheme =
	Object.values(presetThemes)[0] ?? (EMPTY_THEME_VALUES as PartialThemeValues);

export const DEFAULT_THEME_VALUES: ThemeValues = {
	light: fillModeValues(
		presetThemes.zen?.light ?? firstPresetTheme.light,
		EMPTY_THEME_VALUES.light,
	),
	dark: fillModeValues(
		presetThemes.zen?.dark ?? firstPresetTheme.dark,
		EMPTY_THEME_VALUES.dark,
	),
};

export const PRESET_THEME_VALUES = Object.fromEntries(
	Object.entries(presetThemes).map(([themeId, themeValues]) => [
		themeId,
		{
			light: fillModeValues(themeValues.light, DEFAULT_THEME_VALUES.light),
			dark: fillModeValues(themeValues.dark, DEFAULT_THEME_VALUES.dark),
		},
	]),
) as Record<string, ThemeValues>;

const GROUP_DEFINITIONS: ThemeVariableGroup[] = [
	{
		id: "brand",
		label: "Brand",
		keys: [
			"sea-ink",
			"sea-ink-soft",
			"lagoon",
			"lagoon-deep",
			"palm",
			"sand",
			"foam",
			"surface",
			"surface-strong",
			"line",
			"inset-glint",
			"kicker",
			"bg-base",
			"header-bg",
			"chip-bg",
			"chip-line",
			"link-bg-hover",
			"hero-a",
			"hero-b",
		],
	},
	{
		id: "core",
		label: "Core",
		keys: [
			"background",
			"foreground",
			"card",
			"card-foreground",
			"popover",
			"popover-foreground",
			"primary",
			"primary-foreground",
			"secondary",
			"secondary-foreground",
			"muted",
			"muted-foreground",
			"accent",
			"accent-foreground",
			"destructive",
			"destructive-foreground",
			"border",
			"input",
			"ring",
		],
	},
	{
		id: "charts",
		label: "Charts",
		keys: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
	},
	{
		id: "sidebar",
		label: "Sidebar",
		keys: [
			"sidebar",
			"sidebar-foreground",
			"sidebar-primary",
			"sidebar-primary-foreground",
			"sidebar-accent",
			"sidebar-accent-foreground",
			"sidebar-border",
			"sidebar-ring",
		],
	},
	{
		id: "typography",
		label: "Typography",
		keys: [
			"font-sans",
			"font-serif",
			"font-mono",
			"letter-spacing",
			"tracking-normal",
		],
	},
	{
		id: "layout",
		label: "Layout",
		keys: ["radius", "spacing"],
	},
	{
		id: "shadows",
		label: "Shadows",
		keys: [
			"shadow-color",
			"shadow-opacity",
			"shadow-blur",
			"shadow-spread",
			"shadow-offset-x",
			"shadow-offset-y",
			"shadow-x",
			"shadow-y",
			"shadow-2xs",
			"shadow-xs",
			"shadow-sm",
			"shadow",
			"shadow-md",
			"shadow-lg",
			"shadow-xl",
			"shadow-2xl",
		],
	},
];

const groupedKeys = new Set(GROUP_DEFINITIONS.flatMap((group) => group.keys));
const remainingKeys = THEME_VARIABLE_KEYS.filter((key) => !groupedKeys.has(key));

export const THEME_VARIABLE_GROUPS = remainingKeys.length
	? [
			...GROUP_DEFINITIONS,
			{
				id: "other",
				label: "Other",
				keys: remainingKeys,
			},
		]
	: GROUP_DEFINITIONS;

export function getPresetThemeValues(themeId: string) {
	return PRESET_THEME_VALUES[themeId] ?? DEFAULT_THEME_VALUES;
}

export function normalizeThemeValues(
	values?: PartialThemeValues,
	fallback: ThemeValues = DEFAULT_THEME_VALUES,
): ThemeValues {
	return {
		light: fillModeValues(values?.light, fallback.light),
		dark: fillModeValues(values?.dark, fallback.dark),
	};
}

export function parseThemeCss(css: string): PartialThemeValues {
	const lightBlock = css.match(LIGHT_BLOCK_REGEX)?.[1] ?? "";
	const darkBlock = css.match(DARK_BLOCK_REGEX)?.[1] ?? "";

	return {
		light: extractCssVariables(lightBlock),
		dark: extractCssVariables(darkBlock),
	};
}

function serializeThemeBlock(selector: string, values: ThemeVariableMap) {
	const lines = THEME_VARIABLE_KEYS.filter((key) => values[key]?.trim()).map(
		(key) => `  --${key}: ${values[key]};`,
	);

	return `${selector} {\n${lines.join("\n")}\n}`;
}

export function serializeThemeCss(values: ThemeValues) {
	return [
		serializeThemeBlock(":root.theme-custom", values.light),
		serializeThemeBlock(".dark.theme-custom", values.dark),
	].join("\n\n");
}

export function normalizeCustomThemeCss(
	css: string,
	fallback: ThemeValues = DEFAULT_THEME_VALUES,
) {
	return serializeThemeCss(normalizeThemeValues(parseThemeCss(css), fallback));
}

function serializePreviewBlock(selector: string, values: ThemeVariableMap) {
	const lines = THEME_VARIABLE_KEYS.filter((key) => values[key]?.trim()).map(
		(key) => `  --${key}: ${values[key]} !important;`,
	);

	return `${selector} {\n${lines.join("\n")}\n}`;
}

export function applyThemePreview(values: ThemeValues) {
	if (typeof document === "undefined") {
		return;
	}

	let style = document.getElementById(PREVIEW_STYLE_ID);

	if (!style) {
		style = document.createElement("style");
		style.id = PREVIEW_STYLE_ID;
		document.head.appendChild(style);
	}

	style.textContent = [
		serializePreviewBlock(":root", values.light),
		serializePreviewBlock(".dark", values.dark),
	].join("\n\n");
}

export function clearThemePreview() {
	if (typeof document === "undefined") {
		return;
	}

	document.getElementById(PREVIEW_STYLE_ID)?.remove();
}

export function isOklchValue(value: string) {
	return value.trim().startsWith("oklch(");
}

export function parseOklchValue(value: string): OklchColor {
	const match = value.match(
		/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/,
	);

	if (!match) {
		return { l: 0, c: 0, h: 0 };
	}

	return {
		l: Number.parseFloat(match[1]),
		c: Number.parseFloat(match[2]),
		h: Number.parseFloat(match[3]),
	};
}

export function formatOklchValue(color: OklchColor) {
	return `oklch(${color.l.toFixed(4)} ${color.c.toFixed(4)} ${color.h.toFixed(4)})`;
}
