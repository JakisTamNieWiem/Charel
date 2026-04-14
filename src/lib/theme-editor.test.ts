import { describe, expect, it } from "vitest";
import {
	DEFAULT_THEME_VALUES,
	formatShadowValue,
	normalizeThemeValues,
	parseShadowValue,
	parseThemeCss,
	serializeThemeCss,
} from "@/lib/theme-editor";

describe("theme-editor", () => {
	it("fills missing theme values from defaults", () => {
		const values = normalizeThemeValues({
			light: {
				background: "oklch(0.1 0.2 0.3)",
			},
		});

		expect(values.light.background).toBe("oklch(0.1 0.2 0.3)");
		expect(values.dark.background).toBe(DEFAULT_THEME_VALUES.dark.background);
		expect(values.light.foreground).toBe(DEFAULT_THEME_VALUES.light.foreground);
	});

	it("round-trips serialized custom theme css", () => {
		const values = normalizeThemeValues({
			light: {
				background: "oklch(0.1 0.2 0.3)",
				foreground: "rgb(255 255 255)",
			},
			dark: {
				background: "oklch(0.2 0.3 0.4)",
				foreground: "rgb(10 10 10)",
			},
		});

		const parsed = parseThemeCss(serializeThemeCss(values));

		expect(parsed.light?.background).toBe("oklch(0.1 0.2 0.3)");
		expect(parsed.light?.foreground).toBe("rgb(255 255 255)");
		expect(parsed.dark?.background).toBe("oklch(0.2 0.3 0.4)");
		expect(parsed.dark?.foreground).toBe("rgb(10 10 10)");
	});

	it("parses and formats layered shadows", () => {
		const value = "0px 2px 8px 0px rgba(0, 0, 0, 0.24), 1px 1px 2px 0px #fff";
		const layers = parseShadowValue(value);

		expect(layers).not.toBeNull();
		expect(layers).toHaveLength(2);
		expect(layers?.[0]).toMatchObject({
			x: 0,
			y: 2,
			blur: 8,
			spread: 0,
			color: "rgba(0, 0, 0, 0.24)",
		});
		expect(formatShadowValue(layers ?? [])).toBe(
			"0px 2px 8px 0px rgba(0, 0, 0, 0.24), 1px 1px 2px 0px #fff",
		);
	});
});
