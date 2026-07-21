import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearAvatarTextureCache,
	getAvatarTexture,
	getAvatarTextureCacheSize,
	pruneAvatarTextureCache,
} from "@/lib/pixi-avatar-cache";

const pixiMocks = vi.hoisted(() => ({
	destroyTexture: vi.fn(),
	textureFrom: vi.fn(),
}));

vi.mock("pixi.js", () => ({
	Texture: {
		from: pixiMocks.textureFrom,
	},
}));

class ImageMock {
	static instances: ImageMock[] = [];

	crossOrigin: string | null = null;
	decoding = "auto";
	naturalHeight = 512;
	naturalWidth = 1024;
	onerror: (() => void) | null = null;
	onload: (() => void) | null = null;
	src = "";

	constructor() {
		ImageMock.instances.push(this);
	}
}

describe("Pixi avatar texture cache", () => {
	beforeEach(() => {
		ImageMock.instances = [];
		pixiMocks.destroyTexture.mockReset();
		pixiMocks.textureFrom.mockReset();
		pixiMocks.textureFrom.mockImplementation(() => ({
			destroy: pixiMocks.destroyTexture,
		}));
		vi.stubGlobal("Image", ImageMock);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
			() =>
				({
					drawImage: vi.fn(),
					imageSmoothingEnabled: false,
					imageSmoothingQuality: "low",
				}) as never,
		);
	});

	afterEach(() => {
		clearAvatarTextureCache();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("keeps every avatar used by the current graph", () => {
		const activeUrls = new Set<string>();

		for (let index = 0; index < 70; index += 1) {
			const url = `https://example.invalid/avatar-${index}.png`;
			activeUrls.add(url);
			getAvatarTexture(url, () => {});
		}

		pruneAvatarTextureCache(activeUrls);

		expect(getAvatarTextureCacheSize()).toBe(70);
		expect(ImageMock.instances).toHaveLength(70);

		for (const url of activeUrls) getAvatarTexture(url, () => {});
		expect(ImageMock.instances).toHaveLength(70);
	});

	it("prunes textures that are no longer used", async () => {
		getAvatarTexture("keep.png", () => {});
		getAvatarTexture("remove.png", () => {});
		ImageMock.instances[0].onload?.();
		ImageMock.instances[1].onload?.();
		await Promise.resolve();

		pruneAvatarTextureCache(new Set(["keep.png"]));

		expect(getAvatarTextureCacheSize()).toBe(1);
		expect(pixiMocks.destroyTexture).toHaveBeenCalledOnce();
	});

	it("downscales large images before creating textures", () => {
		getAvatarTexture("large.png", () => {});
		const image = ImageMock.instances[0];
		image.naturalWidth = 2048;
		image.naturalHeight = 1024;
		image.onload?.();

		const thumbnail = pixiMocks.textureFrom.mock
			.calls[0][0] as HTMLCanvasElement;

		expect(thumbnail.width).toBe(256);
		expect(thumbnail.height).toBe(128);
	});

	it("keeps only the latest redraw callback while loading", async () => {
		const firstCallback = vi.fn();
		const latestCallback = vi.fn();

		getAvatarTexture("avatar.png", firstCallback);
		getAvatarTexture("avatar.png", latestCallback);
		ImageMock.instances[0].onload?.();
		await Promise.resolve();

		expect(firstCallback).not.toHaveBeenCalled();
		expect(latestCallback).toHaveBeenCalledOnce();
	});

	it("cancels loads for avatars removed from the graph", () => {
		getAvatarTexture("removed.png", () => {});
		const image = ImageMock.instances[0];

		pruneAvatarTextureCache(new Set());

		expect(image.src).toBe("");
		expect(image.onload).toBeNull();
		expect(getAvatarTextureCacheSize()).toBe(0);
	});
});
