import { Texture } from "pixi.js";

const MAX_AVATAR_TEXTURES = 64;

type AvatarTextureEntry = {
	texture: Texture | null;
	loading: boolean;
	failed: boolean;
	callbacks: Set<() => void>;
	lastUsed: number;
	disposed: boolean;
};

const cache = new Map<string, AvatarTextureEntry>();
let accessCounter = 0;

function disposeEntry(entry: AvatarTextureEntry) {
	entry.disposed = true;
	entry.callbacks.clear();
	entry.texture?.destroy(true);
	entry.texture = null;
}

function pruneCache() {
	while (cache.size > MAX_AVATAR_TEXTURES) {
		let oldestKey: string | null = null;
		let oldestAccess = Number.POSITIVE_INFINITY;

		for (const [key, entry] of cache) {
			if (entry.lastUsed < oldestAccess) {
				oldestKey = key;
				oldestAccess = entry.lastUsed;
			}
		}

		if (!oldestKey) return;
		const entry = cache.get(oldestKey);
		cache.delete(oldestKey);
		if (entry) disposeEntry(entry);
	}
}

function notifyReady(entry: AvatarTextureEntry) {
	const callbacks = Array.from(entry.callbacks);
	entry.callbacks.clear();
	for (const callback of callbacks) callback();
}

export function getAvatarTexture(avatarUrl: string, onReady: () => void) {
	const cached = cache.get(avatarUrl);
	if (cached) {
		cached.lastUsed = ++accessCounter;
		if (cached.loading) cached.callbacks.add(onReady);
		return { failed: cached.failed, texture: cached.texture };
	}

	const entry: AvatarTextureEntry = {
		texture: null,
		loading: true,
		failed: false,
		callbacks: new Set([onReady]),
		lastUsed: ++accessCounter,
		disposed: false,
	};
	const image = new Image();
	cache.set(avatarUrl, entry);
	pruneCache();

	const finish = () => {
		if (entry.disposed || entry.texture || entry.failed) return;
		if (!image.naturalWidth || !image.naturalHeight) {
			entry.loading = false;
			entry.failed = true;
			queueMicrotask(() => notifyReady(entry));
			return;
		}

		try {
			entry.texture = Texture.from(image, true);
		} catch {
			entry.failed = true;
		}
		entry.loading = false;
		queueMicrotask(() => notifyReady(entry));
	};
	const fail = () => {
		if (entry.disposed) return;
		entry.loading = false;
		entry.failed = true;
		queueMicrotask(() => notifyReady(entry));
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

export function clearAvatarTextureCache() {
	for (const entry of cache.values()) disposeEntry(entry);
	cache.clear();
}

export function getAvatarTextureCacheSize() {
	return cache.size;
}
