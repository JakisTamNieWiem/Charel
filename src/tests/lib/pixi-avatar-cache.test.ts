import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearAvatarTextureCache,
	getAvatarTexture,
	getAvatarTextureCacheSize,
} from "@/lib/pixi-avatar-cache";

vi.mock("pixi.js", () => ({
	Texture: {
		from: vi.fn(() => ({ destroy: vi.fn() })),
	},
}));

describe("Pixi avatar texture cache", () => {
	afterEach(() => clearAvatarTextureCache());

	it("keeps the cache bounded", () => {
		for (let index = 0; index < 70; index += 1) {
			getAvatarTexture(`https://example.invalid/avatar-${index}.png`, () => {});
		}

		expect(getAvatarTextureCacheSize()).toBe(64);
	});
});
