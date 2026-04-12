// src/components/ThemeProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { normalizeCustomThemeCss } from "@/lib/theme-editor";

export const PRESET_THEMES = [
	{ label: "Zen", value: "zen" },
	{ label: "Damon", value: "damon" },
	{ label: "Caffeine", value: "caffeine" },
	{ label: "Deep Purple", value: "deeppurple" },
	{ label: "Whatsapp", value: "whatsapp" },
] as const;

type ThemeMode = "dark" | "light" | "system";

export type CustomTheme = {
	id: string;
	name: string;
	css: string;
};

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
	addCustomTheme: (theme: CustomTheme) => void;
	removeCustomTheme: (id: string) => void;
	allThemes: ThemeOption[];
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
	undefined,
);

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

	// Store custom themes in LocalStorage (or you could use Tauri's fs here, but this is faster/synchronous for UI)
	const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => {
		const saved = localStorage.getItem("app-custom-themes");

		return saved ? JSON.parse(saved) : [];
	});

	const allThemes = useMemo<ThemeOption[]>(() => {
		return [
			...PRESET_THEMES.map((t) => ({ ...t, isCustom: false })),
			...customThemes.map((t) => ({
				label: t.name,
				value: t.id,
				isCustom: true,
			})),
		];
	}, [customThemes]);

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

		// Remove all previous theme classes
		root.classList.forEach((className) => {
			if (className.startsWith("theme-")) root.classList.remove(className);
		});

		const isPreset = PRESET_THEMES.some((p) => p.value === color);

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
				styleEl.textContent = normalizeCustomThemeCss(activeCustom.css);
			} else {
				// Fallback if custom theme was deleted
				root.classList.add(`theme-${defaultColor}`);
				setColorState(defaultColor);
			}
		}
	}, [color, customThemes, defaultColor]);

	const value = {
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
		addCustomTheme: (newTheme: CustomTheme) => {
			const updated = [
				...customThemes.filter((t) => t.id !== newTheme.id),
				newTheme,
			];
			setCustomThemes(updated);
			localStorage.setItem("app-custom-themes", JSON.stringify(updated));
		},
		removeCustomTheme: (id: string) => {
			const updated = customThemes.filter((t) => t.id !== id);
			setCustomThemes(updated);
			localStorage.setItem("app-custom-themes", JSON.stringify(updated));
			if (color === id) setColorState("zen"); // Reset if they delete active theme
		},
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
