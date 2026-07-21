import { Texture } from "pixi.js";

const MAX_AVATAR_TEXTURE_SIZE = 256;

type AvatarTextureEntry = {
	texture: Texture | null;
	image: HTMLImageElement | null;
	loading: boolean;
	failed: boolean;
	onReady: (() => void) | null;
	disposed: boolean;
};

const cache = new Map<string, AvatarTextureEntry>();

function releaseImage(entry: AvatarTextureEntry, cancel: boolean) {
	const image = entry.image;

	if (!image) return;

	image.onload = null;
	image.onerror = null;

	if (cancel) {
		image.src = "";
	}

	entry.image = null;
}

function disposeEntry(entry: AvatarTextureEntry) {
	entry.disposed = true;
	entry.onReady = null;
	releaseImage(entry, entry.loading);
	entry.texture?.destroy(true);
	entry.texture = null;
}

function notifyReady(entry: AvatarTextureEntry) {
	const onReady = entry.onReady;

	entry.onReady = null;
	if (onReady) {
		queueMicrotask(() => {
			if (!entry.disposed) onReady();
		});
	}
}

function createThumbnail(image: HTMLImageElement) {
	const scale = Math.min(
		1,
		MAX_AVATAR_TEXTURE_SIZE / Math.max(image.naturalWidth, image.naturalHeight),
	);
	const canvas = document.createElement("canvas");

	canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
	canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

	const context = canvas.getContext("2d");

	if (!context) return null;

	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(image, 0, 0, canvas.width, canvas.height);

	return canvas;
}

export function getAvatarTexture(avatarUrl: string, onReady: () => void) {
	const cached = cache.get(avatarUrl);

	if (cached) {
		if (cached.loading) cached.onReady = onReady;
		return { failed: cached.failed, texture: cached.texture };
	}

	const image = new Image();
	const entry: AvatarTextureEntry = {
		texture: null,
		image,
		loading: true,
		failed: false,
		onReady,
		disposed: false,
	};

	cache.set(avatarUrl, entry);

	const finish = () => {
		if (entry.disposed || entry.texture || entry.failed) return;

		if (!image.naturalWidth || !image.naturalHeight) {
			entry.loading = false;
			entry.failed = true;
			releaseImage(entry, false);
			notifyReady(entry);
			return;
		}

		try {
			const thumbnail = createThumbnail(image);

			if (!thumbnail) throw new Error("Could not create avatar thumbnail");
			entry.texture = Texture.from(thumbnail, true);
		} catch {
			entry.failed = true;
		}

		entry.loading = false;
		releaseImage(entry, false);
		notifyReady(entry);
	};
	const fail = () => {
		if (entry.disposed) return;
		entry.loading = false;
		entry.failed = true;
		releaseImage(entry, false);
		notifyReady(entry);
	};

	image.decoding = "async";
	if (!avatarUrl.startsWith("data:") && !avatarUrl.startsWith("blob:")) {
		image.crossOrigin = "anonymous";
	}
	image.onload = finish;
	image.onerror = fail;
	image.src = avatarUrl;

	return { failed: false, texture: null };
}

export function pruneAvatarTextureCache(activeAvatarUrls: ReadonlySet<string>) {
	for (const [avatarUrl, entry] of cache) {
		if (activeAvatarUrls.has(avatarUrl)) continue;
		cache.delete(avatarUrl);
		disposeEntry(entry);
	}
}

export function clearAvatarTextureCache() {
	for (const entry of cache.values()) disposeEntry(entry);
	cache.clear();
}

export function getAvatarTextureCacheSize() {
	return cache.size;
}
