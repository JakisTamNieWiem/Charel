import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	type CustomTheme,
	ThemeProvider,
	useTheme,
} from "@/components/ThemeProvider";

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
});
