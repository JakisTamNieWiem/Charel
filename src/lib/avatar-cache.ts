import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { join, tempDir } from "@tauri-apps/api/path";

// In-memory cache: remote URL → local file path (survives the session, not across restarts)
const cache = new Map<string, string>();

/**
 * Downloads a remote avatar URL to the OS temp directory and returns the
 * local file path. Subsequent calls for the same URL return the cached path
 * without re-downloading.
 *
 * Returns null if the URL is empty or the download fails.
 */
export async function getLocalAvatarPath(url: string | null | undefined): Promise<string | null> {
	if (!url) return null;
	if (cache.has(url)) return cache.get(url)!;

	try {
		const tmp = await tempDir();
		const avatarDir = await join(tmp, ".temp", "charel-avatars");

		if (!(await exists(avatarDir))) {
			await mkdir(avatarDir, { recursive: true });
		}

		// Stable filename derived from the URL (no query params, truncated hash)
		const ext = url.startsWith("data:")
			? (url.match(/data:image\/(\w+)/)?.[1] ?? "jpg")
			: (url.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg");
		const hash = btoa(encodeURIComponent(url)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
		const filePath = await join(avatarDir, `${hash}.${ext}`);

		if (!(await exists(filePath))) {
			if (url.startsWith("data:")) {
				// Base64 data URL — decode directly, no network request needed
				const base64 = url.split(",")[1];
				if (!base64) throw new Error("Invalid data URL");
				const binary = atob(base64);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
				await writeFile(filePath, bytes);
			} else {
				const response = await fetch(url);
				if (!response.ok) throw new Error(`Failed to fetch avatar: ${response.status}`);
				const buffer = await response.arrayBuffer();
				await writeFile(filePath, new Uint8Array(buffer));
			}
		}

		cache.set(url, filePath);
		return filePath;
	} catch (e) {
		console.error("avatar-cache: failed to cache avatar", e);
		return null;
	}
}
