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
export type RgbaColor = {
	r: number;
	g: number;
	b: number;
	a: number;
};
export type BoxShadowLayer = {
	x: number;
	y: number;
	blur: number;
	spread: number;
	color: string;
};

const THEME_BLOCK_REGEX = /(:root|\.dark)\.theme-([a-z0-9-]+)\s*{([\s\S]*?)}/g;
const CSS_VARIABLE_REGEX = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
const LIGHT_BLOCK_REGEX = /:root(?:\.[a-zA-Z0-9-]+)?[^{]*{([\s\S]*?)}/;
const DARK_BLOCK_REGEX = /\.dark(?:\.[a-zA-Z0-9-]+)?[^{]*{([\s\S]*?)}/;
const PREVIEW_STYLE_ID = "theme-preview-style";
const FONT_VARIABLE_KEYS = ["font-sans", "font-serif", "font-mono"] as const;
const GENERIC_FONT_FAMILIES = new Set([
	"serif",
	"sans-serif",
	"monospace",
	"cursive",
	"fantasy",
	"system-ui",
	"ui-serif",
	"ui-sans-serif",
	"ui-monospace",
	"ui-rounded",
	"math",
	"emoji",
	"fangsong",
]);
const LOCAL_FONT_FAMILIES = new Set([
	"geist",
	"geist mono",
	"inter",
	"playfair display",
	"jetbrains mono",
	"plus jakarta sans",
	"georgia",
	"times new roman",
	"times",
	"cambria",
	"arial",
	"helvetica",
	"helvetica neue",
	"lucida grande",
	"segoe ui",
	"roboto",
	"ubuntu",
	"cantarell",
	"fira sans",
	"noto sans",
	"apple color emoji",
	"segoe ui emoji",
	"segoe ui symbol",
	"noto color emoji",
	"sfmono-regular",
	"menlo",
	"monaco",
	"consolas",
	"liberation mono",
	"courier new",
	"-apple-system",
	"blinkmacsystemfont",
]);

function splitFontFamilyList(value: string) {
	const parts: string[] = [];
	let current = "";
	let quote: string | null = null;

	for (const char of value) {
		if (quote) {
			current += char;
			if (char === quote) {
				quote = null;
			}
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			current += char;
			continue;
		}

		if (char === ",") {
			if (current.trim()) {
				parts.push(current.trim());
			}
			current = "";
			continue;
		}

		current += char;
	}

	if (current.trim()) {
		parts.push(current.trim());
	}

	return parts;
}

function normalizeFontFamily(value: string) {
	return value.trim().replace(/^['"]|['"]$/g, "");
}

function isCustomHostedFontFamily(family: string) {
	const normalizedFamily = normalizeFontFamily(family).toLowerCase();

	return (
		Boolean(normalizedFamily) &&
		!GENERIC_FONT_FAMILIES.has(normalizedFamily) &&
		!LOCAL_FONT_FAMILIES.has(normalizedFamily)
	);
}

function collectCustomThemeFonts(values: ThemeValues) {
	const families = new Set<string>();

	for (const mode of ["light", "dark"] as const) {
		for (const key of FONT_VARIABLE_KEYS) {
			const value = values[mode][key];
			if (!value) {
				continue;
			}

			for (const family of splitFontFamilyList(value)) {
				if (isCustomHostedFontFamily(family)) {
					families.add(normalizeFontFamily(family));
				}
			}
		}
	}

	return [...families].sort((left, right) => left.localeCompare(right));
}

function toGoogleFontsFamilyParam(family: string) {
	return `family=${encodeURIComponent(family.replace(/\s+/g, " ").trim()).replace(/%20/g, "+")}:wght@400;500;600;700`;
}

export function getThemeFontImportUrl(values: ThemeValues) {
	const families = collectCustomThemeFonts(values);

	if (families.length === 0) {
		return null;
	}

	const params = families.map(toGoogleFontsFamilyParam).join("&");

	return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

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
		THEME_VARIABLE_KEYS.map((key) => [
			key,
			values?.[key] ?? fallback?.[key] ?? "",
		]),
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

const HIDDEN_THEME_VARIABLE_KEYS = new Set([
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
]);

const GROUP_DEFINITIONS: ThemeVariableGroup[] = [
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
const remainingKeys = THEME_VARIABLE_KEYS.filter(
	(key) => !groupedKeys.has(key) && !HIDDEN_THEME_VARIABLE_KEYS.has(key),
);

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

const THEME_VARIABLE_DESCRIPTIONS: Record<string, string> = {
	background: "Main app background",
	foreground: "Primary text color",
	card: "Panel surface color",
	"card-foreground": "Text on panels",
	popover: "Popover surface color",
	"popover-foreground": "Text on popovers",
	primary: "Primary action color",
	"primary-foreground": "Text on primary",
	secondary: "Secondary surface color",
	"secondary-foreground": "Text on secondary",
	muted: "Subtle surface color",
	"muted-foreground": "Muted text color",
	accent: "Accent highlight color",
	"accent-foreground": "Text on accent",
	destructive: "Danger action color",
	"destructive-foreground": "Text on danger",
	border: "Default border color",
	input: "Input border color",
	ring: "Focus ring color",
	"chart-1": "Chart series one",
	"chart-2": "Chart series two",
	"chart-3": "Chart series three",
	"chart-4": "Chart series four",
	"chart-5": "Chart series five",
	sidebar: "Sidebar background color",
	"sidebar-foreground": "Sidebar text color",
	"sidebar-primary": "Sidebar primary color",
	"sidebar-primary-foreground": "Text on sidebar primary",
	"sidebar-accent": "Sidebar accent color",
	"sidebar-accent-foreground": "Text on sidebar accent",
	"sidebar-border": "Sidebar border color",
	"sidebar-ring": "Sidebar focus ring",
	"font-sans": "Default UI font",
	"font-serif": "Serif font stack",
	"font-mono": "Monospace font stack",
	"letter-spacing": "Global letter spacing",
	"tracking-normal": "Base tracking value",
	radius: "Base corner radius",
	spacing: "Base spacing unit",
	"shadow-color": "Shadow tint color",
	"shadow-opacity": "Global shadow opacity",
	"shadow-blur": "Default shadow blur",
	"shadow-spread": "Default shadow spread",
	"shadow-offset-x": "Default shadow X",
	"shadow-offset-y": "Default shadow Y",
	"shadow-x": "Shared shadow X",
	"shadow-y": "Shared shadow Y",
	"shadow-2xs": "Tiny elevation recipe",
	"shadow-xs": "Extra small shadow",
	"shadow-sm": "Small elevation recipe",
	shadow: "Default elevation recipe",
	"shadow-md": "Medium elevation recipe",
	"shadow-lg": "Large elevation recipe",
	"shadow-xl": "Extra large shadow",
	"shadow-2xl": "Max elevation recipe",
};

export function getThemeVariableDescription(key: string) {
	if (THEME_VARIABLE_DESCRIPTIONS[key]) {
		return THEME_VARIABLE_DESCRIPTIONS[key];
	}

	if (key.endsWith("-foreground")) {
		return "Text for this token";
	}

	if (key.includes("border")) {
		return "Border color value";
	}

	if (key.includes("ring")) {
		return "Focus ring value";
	}

	if (key.startsWith("font-")) {
		return "Font stack value";
	}

	if (key.startsWith("shadow-")) {
		return "Shadow token value";
	}

	return "Theme token value";
}

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

export function serializeThemeCssWithFontImports(values: ThemeValues) {
	const fontImportUrl = getThemeFontImportUrl(values);
	const css = serializeThemeCss(values);

	return fontImportUrl ? `@import url("${fontImportUrl}");\n\n${css}` : css;
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

	const fontImportUrl = getThemeFontImportUrl(values);
	const previewCss = [
		serializePreviewBlock(":root", values.light),
		serializePreviewBlock(".dark", values.dark),
	].join("\n\n");
	style.textContent = fontImportUrl
		? `@import url("${fontImportUrl}");\n\n${previewCss}`
		: previewCss;
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
	const match = value.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)/);

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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function parseHexColor(value: string): RgbaColor | null {
	const hex = value.trim().replace("#", "");

	if (![3, 4, 6, 8].includes(hex.length)) {
		return null;
	}

	const normalized =
		hex.length <= 4
			? hex
					.split("")
					.map((char) => `${char}${char}`)
					.join("")
			: hex;

	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);
	const alpha =
		normalized.length === 8
			? Number.parseInt(normalized.slice(6, 8), 16) / 255
			: 1;

	if ([red, green, blue].some(Number.isNaN)) {
		return null;
	}

	return { r: red, g: green, b: blue, a: alpha };
}

function parseFunctionalColor(value: string) {
	const match = value.trim().match(/^(rgba?|hsla?)\(\s*(.*?)\s*\)$/i);

	if (!match) {
		return null;
	}

	const fnName = match[1].toLowerCase();
	const rawArgs = match[2].replace(/,/g, " ");
	const [rawChannels, rawAlpha] = rawArgs
		.split("/")
		.map((part: string) => part.trim());
	const channels = rawChannels.split(/\s+/).filter(Boolean);

	if (fnName.startsWith("rgb")) {
		const [r, g, b, aValue] = channels;
		const alpha = rawAlpha || aValue;
		const parsed = [r, g, b].map((channel) => Number.parseFloat(channel));

		if (parsed.some(Number.isNaN)) {
			return null;
		}

		return {
			r: clamp(Math.round(parsed[0]), 0, 255),
			g: clamp(Math.round(parsed[1]), 0, 255),
			b: clamp(Math.round(parsed[2]), 0, 255),
			a: clamp(Number.parseFloat(alpha ?? "1"), 0, 1),
		} satisfies RgbaColor;
	}

	const [hueValue, saturationValue, lightnessValue, alphaValue] = channels;
	const hue = Number.parseFloat(hueValue);
	const saturation = Number.parseFloat(saturationValue);
	const lightness = Number.parseFloat(lightnessValue);
	const alpha = rawAlpha || alphaValue;

	if ([hue, saturation, lightness].some(Number.isNaN)) {
		return null;
	}

	return hslToRgb({
		h: hue,
		s: saturation / 100,
		l: lightness / 100,
		a: clamp(Number.parseFloat(alpha ?? "1"), 0, 1),
	});
}

export function isColorValue(value: string) {
	const normalized = value.trim().toLowerCase();
	return (
		normalized.startsWith("oklch(") ||
		normalized.startsWith("#") ||
		normalized.startsWith("rgb(") ||
		normalized.startsWith("rgba(") ||
		normalized.startsWith("hsl(") ||
		normalized.startsWith("hsla(")
	);
}

export function parseColorValue(value: string): RgbaColor | null {
	if (isOklchValue(value)) {
		return oklchToRgb(parseOklchValue(value));
	}

	return parseHexColor(value) ?? parseFunctionalColor(value);
}

export function formatRgbaValue(color: RgbaColor) {
	const alpha = Number(color.a.toFixed(2));

	if (alpha >= 1) {
		return `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)})`;
	}

	return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(
		color.b,
	)}, ${alpha})`;
}

export function formatHexColor(color: RgbaColor) {
	const toHex = (value: number) =>
		clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

	return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function parseLengthValue(value: string) {
	const match = value.trim().match(/^(-?\d*\.?\d+)([a-z%]*)$/i);

	if (!match) {
		return null;
	}

	return {
		value: Number.parseFloat(match[1]),
		unit: match[2] || "px",
	};
}

export function formatLengthValue(value: number, unit: string) {
	return `${Number(value.toFixed(3))}${unit}`;
}

function splitCssValueList(value: string) {
	const parts: string[] = [];
	let current = "";
	let depth = 0;

	for (const char of value) {
		if (char === "(") {
			depth += 1;
		} else if (char === ")") {
			depth = Math.max(0, depth - 1);
		}

		if (char === "," && depth === 0) {
			parts.push(current.trim());
			current = "";
			continue;
		}

		current += char;
	}

	if (current.trim()) {
		parts.push(current.trim());
	}

	return parts;
}

export function parseShadowValue(value: string): BoxShadowLayer[] | null {
	const layers = splitCssValueList(value)
		.map((layer) => {
			const match = layer.match(
				/^\s*(-?\d*\.?\d+)(?:px|rem|em|%)?\s+(-?\d*\.?\d+)(?:px|rem|em|%)?\s+(-?\d*\.?\d+)(?:px|rem|em|%)?\s+(-?\d*\.?\d+)(?:px|rem|em|%)?\s+(.+)\s*$/i,
			);

			if (!match) {
				return null;
			}

			return {
				x: Number.parseFloat(match[1]),
				y: Number.parseFloat(match[2]),
				blur: Number.parseFloat(match[3]),
				spread: Number.parseFloat(match[4]),
				color: match[5].trim(),
			} satisfies BoxShadowLayer;
		})
		.filter((layer) => layer !== null);

	return layers.length > 0 ? layers : null;
}

export function formatShadowValue(layers: BoxShadowLayer[]) {
	return layers
		.map(
			(layer) =>
				`${layer.x}px ${layer.y}px ${layer.blur}px ${layer.spread}px ${layer.color}`,
		)
		.join(", ");
}

function hslToRgb({
	h,
	s,
	l,
	a,
}: {
	h: number;
	s: number;
	l: number;
	a: number;
}): RgbaColor {
	const hue = ((h % 360) + 360) % 360;
	const chroma = (1 - Math.abs(2 * l - 1)) * s;
	const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = l - chroma / 2;

	let red = 0;
	let green = 0;
	let blue = 0;

	if (hue < 60) {
		red = chroma;
		green = x;
	} else if (hue < 120) {
		red = x;
		green = chroma;
	} else if (hue < 180) {
		green = chroma;
		blue = x;
	} else if (hue < 240) {
		green = x;
		blue = chroma;
	} else if (hue < 300) {
		red = x;
		blue = chroma;
	} else {
		red = chroma;
		blue = x;
	}

	return {
		r: Math.round((red + m) * 255),
		g: Math.round((green + m) * 255),
		b: Math.round((blue + m) * 255),
		a,
	};
}

function linearToSrgb(value: number) {
	const normalized =
		value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

	return clamp(Math.round(normalized * 255), 0, 255);
}

function oklchToRgb(color: OklchColor): RgbaColor {
	const angle = (color.h * Math.PI) / 180;
	const a = color.c * Math.cos(angle);
	const b = color.c * Math.sin(angle);
	const lValue = color.l + 0.3963377774 * a + 0.2158037573 * b;
	const mValue = color.l - 0.1055613458 * a - 0.0638541728 * b;
	const sValue = color.l - 0.0894841775 * a - 1.291485548 * b;
	const l = lValue ** 3;
	const m = mValue ** 3;
	const s = sValue ** 3;

	const redLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const greenLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const blueLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	return {
		r: linearToSrgb(redLinear),
		g: linearToSrgb(greenLinear),
		b: linearToSrgb(blueLinear),
		a: 1,
	};
}
