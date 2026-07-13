import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CustomTheme,
	ThemeProvider,
	useTheme,
} from "@/context/ThemeProvider";

const themeStorageMocks = vi.hoisted(() => ({
	loadStoredCustomThemes: vi.fn<() => Promise<CustomTheme[]>>(),
	watchStoredCustomThemes: vi.fn(),
}));

vi.mock("@/lib/theme-storage", () => ({
	loadLegacyCustomThemes: () => [],
	loadStoredCustomThemes: themeStorageMocks.loadStoredCustomThemes,
	saveStoredCustomTheme: vi.fn(),
	openCustomThemesFolder: vi.fn(),
	watchStoredCustomThemes: themeStorageMocks.watchStoredCustomThemes,
}));

function ThemeProbe() {
	const { color, customThemes } = useTheme();

	return (
		<div>
			<div data-testid="color">{color}</div>
			<div data-testid="custom-count">{customThemes.length}</div>
		</div>
	);
}

describe("ThemeProvider", () => {
	beforeEach(() => {
		themeStorageMocks.loadStoredCustomThemes.mockReset().mockResolvedValue([]);
		themeStorageMocks.watchStoredCustomThemes
			.mockReset()
			.mockResolvedValue(() => {});
	});

	it("falls back to the default preset when the selected custom theme disappears", async () => {
		const theme = {
			id: "custom-1",
			name: "Custom One",
			values: {
				light: {
					background: "oklch(0.1 0.2 0.3)",
				},
				dark: {
					background: "oklch(0.2 0.3 0.4)",
				},
			},
		} as CustomTheme;
		let onWatch: (() => void | Promise<void>) | null = null;

		themeStorageMocks.loadStoredCustomThemes
			.mockResolvedValueOnce([theme])
			.mockResolvedValueOnce([]);
		themeStorageMocks.watchStoredCustomThemes.mockImplementation(
			async (callback) => {
				onWatch = callback;
				return () => {};
			},
		);
		localStorage.setItem("app-color", theme.id);

		render(
			<ThemeProvider defaultTheme="light" defaultColor="zen">
				<ThemeProbe />
			</ThemeProvider>,
		);

		await waitFor(() =>
			expect(screen.getByTestId("color").textContent).toBe(theme.id),
		);
		expect(screen.getByTestId("custom-count").textContent).toBe("1");

		await act(async () => {
			await onWatch?.();
		});

		await waitFor(() =>
			expect(screen.getByTestId("color").textContent).toBe("zen"),
		);
		expect(screen.getByTestId("custom-count").textContent).toBe("0");
	});

	it("follows system theme changes while system mode is active", async () => {
		let matches = false;
		let onChange: (() => void) | null = null;
		vi.mocked(window.matchMedia).mockImplementation(
			(query) =>
				({
					get matches() {
						return matches;
					},
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn((_event, listener) => {
						onChange = listener as () => void;
					}),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
				}) as MediaQueryList,
		);

		render(
			<ThemeProvider defaultTheme="system">
				<ThemeProbe />
			</ThemeProvider>,
		);
		expect(document.documentElement.classList.contains("light")).toBe(true);

		matches = true;
		await act(async () => onChange?.());

		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});
});
