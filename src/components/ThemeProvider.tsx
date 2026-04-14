// src/components/ThemeProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { normalizeThemeValues, serializeThemeCss } from "@/lib/theme-editor";
import {
	loadLegacyCustomThemes,
	loadStoredCustomThemes,
	openCustomThemesFolder as revealCustomThemesFolder,
	type StoredCustomTheme,
	saveStoredCustomTheme,
} from "@/lib/theme-storage";

export const PRESET_THEMES = [
	{ label: "Zen", value: "zen" },
	{ label: "Damon", value: "damon" },
	{ label: "Caffeine", value: "caffeine" },
	{ label: "Deep Purple", value: "deeppurple" },
	{ label: "Whatsapp", value: "whatsapp" },
] as const;

type ThemeMode = "dark" | "light" | "system";

export type CustomTheme = StoredCustomTheme;

export type ThemeOption = {
	label: string;
	value: string;
	isCustom: boolean;
};

type ThemeProviderState = {
	theme: ThemeMode;
	setTheme: (theme: ThemeMode) => void;
	color: string;
	setColor: (color: string) => void;
	customThemes: CustomTheme[];
	customThemesLoaded: boolean;
	addCustomTheme: (theme: CustomTheme) => Promise<void>;
	openCustomThemesFolder: () => Promise<string>;
	allThemes: ThemeOption[];
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
	undefined,
);

function sortCustomThemes(themes: CustomTheme[]) {
	return [...themes].sort((left, right) => left.name.localeCompare(right.name));
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	defaultColor = "zen",
}: {
	children: React.ReactNode;
	defaultTheme?: ThemeMode;
	defaultColor?: string;
}) {
	const [theme, setThemeState] = useState<ThemeMode>(
		() => (localStorage.getItem("app-theme") as ThemeMode) || defaultTheme,
	);

	const [color, setColorState] = useState<string>(
		() => localStorage.getItem("app-color") || defaultColor,
	);

	const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() =>
		sortCustomThemes(loadLegacyCustomThemes()),
	);
	const [customThemesLoaded, setCustomThemesLoaded] = useState(false);

	const allThemes = useMemo<ThemeOption[]>(() => {
		return [
			...PRESET_THEMES.map((t) => ({ ...t, isCustom: false })),
			...sortCustomThemes(customThemes).map((t) => ({
				label: t.name,
				value: t.id,
				isCustom: true,
			})),
		];
	}, [customThemes]);

	useEffect(() => {
		let cancelled = false;

		void loadStoredCustomThemes()
			.then((loadedThemes) => {
				if (cancelled) {
					return;
				}

				setCustomThemes(sortCustomThemes(loadedThemes));
			})
			.catch((error) => {
				console.error("Failed to hydrate custom themes:", error);
			})
			.finally(() => {
				if (!cancelled) {
					setCustomThemesLoaded(true);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	// 1. Apply Dark/Light mode
	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");
		if (theme === "system") {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
				.matches
				? "dark"
				: "light";
			root.classList.add(systemTheme);
		} else {
			root.classList.add(theme);
		}
	}, [theme]);

	// 2. Apply Theme Color Classes & Inject Custom CSS
	useEffect(() => {
		const root = window.document.documentElement;
		let styleEl = document.getElementById("custom-theme-style");
		const isPreset = PRESET_THEMES.some((p) => p.value === color);

		if (!isPreset && !customThemesLoaded) {
			return;
		}

		// Remove all previous theme classes
		root.classList.forEach((className) => {
			if (className.startsWith("theme-")) root.classList.remove(className);
		});

		if (isPreset) {
			// It's a built-in theme
			root.classList.add(`theme-${color}`);
			if (styleEl) styleEl.remove();
		} else {
			// It's a custom theme!
			const activeCustom = customThemes.find((t) => t.id === color);
			if (activeCustom) {
				// We apply a generic "theme-custom" class to the HTML
				root.classList.add("theme-custom");

				// Inject the specific CSS for this theme
				if (!styleEl) {
					styleEl = document.createElement("style");
					styleEl.id = "custom-theme-style";
					document.head.appendChild(styleEl);
				}
				styleEl.textContent = serializeThemeCss(activeCustom.values);
			} else {
				// Fallback if custom theme was deleted
				root.classList.add(`theme-${defaultColor}`);
				localStorage.setItem("app-color", defaultColor);
				setColorState(defaultColor);
			}
		}
	}, [color, customThemes, customThemesLoaded, defaultColor]);

	const value: ThemeProviderState = {
		theme,
		setTheme: (newTheme: ThemeMode) => {
			localStorage.setItem("app-theme", newTheme);
			setThemeState(newTheme);
		},
		color,
		setColor: (newColor: string) => {
			localStorage.setItem("app-color", newColor);
			setColorState(newColor);
		},
		customThemes,
		customThemesLoaded,
		addCustomTheme: async (newTheme: CustomTheme) => {
			const normalizedTheme = {
				...newTheme,
				name: newTheme.name.trim() || "Custom Theme",
				values: normalizeThemeValues(newTheme.values),
			};
			const updated = await saveStoredCustomTheme(
				normalizedTheme,
				customThemes,
			);
			setCustomThemes(updated);
		},
		openCustomThemesFolder: () => revealCustomThemesFolder(),
		allThemes,
	};

	return (
		<ThemeProviderContext.Provider value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);
	if (context === undefined)
		throw new Error("useTheme must be used within a ThemeProvider");
	return context;
};
