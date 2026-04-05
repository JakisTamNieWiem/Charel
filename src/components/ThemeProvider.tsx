// src/components/ThemeProvider.tsx
import { createContext, useContext, useEffect, useState } from "react";

export const THEME_PALETTES = [
	{ label: "Zen", value: "zen" },
	{ label: "Damon", value: "damon" },
] as const;

type ThemeMode = "dark" | "light" | "system";
export type ThemeColor = (typeof THEME_PALETTES)[number]["value"];

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: ThemeMode;
	defaultColor?: ThemeColor;
};

type ThemeProviderState = {
	theme: ThemeMode;
	setTheme: (theme: ThemeMode) => void;
	color: ThemeColor;
	setColor: (color: ThemeColor) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
	undefined,
);

export function ThemeProvider({
	children,
	defaultTheme = "system",
	defaultColor = "zen",
}: ThemeProviderProps) {
	// 1. State for Light/Dark
	const [theme, setThemeState] = useState<ThemeMode>(
		() => (localStorage.getItem("app-theme") as ThemeMode) || defaultTheme,
	);

	// 2. State for Color Palette
	const [color, setColorState] = useState<ThemeColor>(
		() => (localStorage.getItem("app-color") as ThemeColor) || defaultColor,
	);

	// 3. Effect to apply Light/Dark classes
	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");

		if (theme === "system") {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
				.matches
				? "dark"
				: "light";
			root.classList.add(systemTheme);
			return;
		}
		root.classList.add(theme);
	}, [theme]);

	// 4. Effect to apply Color Palette classes
	useEffect(() => {
		const root = window.document.documentElement;

		// Strip out any existing color classes to prevent conflicts
		root.classList.forEach((className) => {
			if (className.startsWith("theme-")) {
				root.classList.remove(className);
			}
		});

		// Add the new color class (e.g., "theme-rose")
		root.classList.add(`theme-${color}`);
	}, [color]);

	const value = {
		theme,
		setTheme: (newTheme: ThemeMode) => {
			localStorage.setItem("app-theme", newTheme);
			setThemeState(newTheme);
		},
		color,
		setColor: (newColor: ThemeColor) => {
			localStorage.setItem("app-color", newColor);
			setColorState(newColor);
		},
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
