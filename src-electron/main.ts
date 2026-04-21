import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize } from "node:path";
import {
	Notification,
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	nativeImage,
	shell,
} from "electron";

type FileFilter = {
	name: string;
	extensions: string[];
};

type WatcherRecord = {
	close: () => void;
	timeout: NodeJS.Timeout | null;
};

const appDataIdentifier = "com.jtnw.charel";
const watcherRecords = new Map<string, WatcherRecord>();

app.setName("charel");
app.setPath("userData", join(app.getPath("appData"), appDataIdentifier));

function resolveAppDataPath(relativePath = "") {
	const normalizedPath = normalize(relativePath || ".");

	if (
		isAbsolute(normalizedPath) ||
		normalizedPath === ".." ||
		normalizedPath.startsWith("../") ||
		normalizedPath.startsWith("..\\")
	) {
		throw new Error(`Unsafe AppData path: ${relativePath}`);
	}

	return join(app.getPath("userData"), normalizedPath);
}

async function ensureParentDirectory(filePath: string) {
	await mkdir(dirname(filePath), { recursive: true });
}

function getMainWindow() {
	return BrowserWindow.getAllWindows()[0] ?? null;
}

function createWindow() {
	const mainWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		minWidth: 600,
		minHeight: 800,
		title: "Charel",
		frame: false,
		backgroundColor: "#000000",
		show: false,
		icon: join(__dirname, "../../build/icons/icon.png"),
		webPreferences: {
			preload: join(__dirname, "../preload/preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	mainWindow.once("ready-to-show", () => mainWindow.show());

	if (process.env.ELECTRON_RENDERER_URL) {
		void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}
}

function registerWindowHandlers() {
	ipcMain.handle("window:minimize", () => getMainWindow()?.minimize());
	ipcMain.handle("window:toggle-maximize", () => {
		const window = getMainWindow();
		if (!window) return;

		if (window.isMaximized()) {
			window.unmaximize();
		} else {
			window.maximize();
		}
	});
	ipcMain.handle("window:close", () => getMainWindow()?.close());
}

function registerAppHandlers() {
	ipcMain.handle("app:get-version", () => app.getVersion());
	ipcMain.handle("app:relaunch", () => {
		app.relaunch();
		app.exit(0);
	});
}

function registerFileHandlers() {
	ipcMain.handle("fs:exists-app-data", (_event, relativePath: string) =>
		existsSync(resolveAppDataPath(relativePath)),
	);

	ipcMain.handle("fs:mkdir-app-data", async (_event, relativePath: string) => {
		await mkdir(resolveAppDataPath(relativePath), { recursive: true });
	});

	ipcMain.handle("fs:read-app-data-dir", async (_event, relativePath: string) => {
		const entries = await readdir(resolveAppDataPath(relativePath), {
			withFileTypes: true,
		});

		return entries.map((entry) => ({
			name: entry.name,
			isFile: entry.isFile(),
			isDirectory: entry.isDirectory(),
		}));
	});

	ipcMain.handle(
		"fs:read-app-data-text-file",
		(_event, relativePath: string) =>
			readFile(resolveAppDataPath(relativePath), "utf8"),
	);

	ipcMain.handle(
		"fs:write-app-data-text-file",
		async (_event, relativePath: string, contents: string) => {
			const filePath = resolveAppDataPath(relativePath);
			await ensureParentDirectory(filePath);
			await writeFile(filePath, contents, "utf8");
		},
	);

	ipcMain.handle("fs:remove-app-data-path", async (_event, relativePath: string) => {
		await rm(resolveAppDataPath(relativePath), { recursive: true, force: true });
	});

	ipcMain.handle("fs:path-exists", (_event, filePath: string) =>
		existsSync(filePath),
	);

	ipcMain.handle("fs:mkdir", async (_event, path: string) => {
		await mkdir(path, { recursive: true });
	});

	ipcMain.handle("fs:read-text-file", (_event, path: string) =>
		readFile(path, "utf8"),
	);

	ipcMain.handle("fs:write-text-file", async (_event, path: string, contents: string) => {
		await ensureParentDirectory(path);
		await writeFile(path, contents, "utf8");
	});

	ipcMain.handle("fs:write-file", async (_event, path: string, bytes: Uint8Array) => {
		await ensureParentDirectory(path);
		await writeFile(path, Buffer.from(bytes));
	});
}

function registerPathHandlers() {
	ipcMain.handle("path:app-data-dir", () => app.getPath("userData"));
	ipcMain.handle("path:temp-dir", () => app.getPath("temp"));
	ipcMain.handle("path:join", (_event, ...parts: string[]) => join(...parts));
}

function registerDialogHandlers() {
	ipcMain.handle(
		"dialog:open-file",
		async (
			_event,
			options: {
				title?: string;
				filters?: FileFilter[];
			},
		) => {
			const result = await dialog.showOpenDialog(getMainWindow() ?? undefined, {
				title: options.title,
				properties: ["openFile"],
				filters: options.filters,
			});

			return result.canceled ? null : result.filePaths[0] ?? null;
		},
	);

	ipcMain.handle(
		"dialog:save-file",
		async (
			_event,
			options: {
				defaultPath?: string;
				filters?: FileFilter[];
			},
		) => {
			const result = await dialog.showSaveDialog(getMainWindow() ?? undefined, {
				defaultPath: options.defaultPath,
				filters: options.filters,
			});

			return result.canceled ? null : result.filePath ?? null;
		},
	);
}

function registerOpenerHandlers() {
	ipcMain.handle("opener:open-path", async (_event, path: string) => {
		const errorMessage = await shell.openPath(path);

		if (errorMessage) {
			throw new Error(errorMessage);
		}

		return path;
	});
}

function registerNotificationHandlers() {
	ipcMain.handle("notification:is-permission-granted", () =>
		Notification.isSupported(),
	);
	ipcMain.handle("notification:request-permission", () =>
		Notification.isSupported() ? "granted" : "denied",
	);
	ipcMain.handle(
		"notification:send",
		(
			_event,
			options: {
				title: string;
				body: string;
				avatar?: string | null;
			},
		) => {
			if (!Notification.isSupported()) {
				return;
			}

			const icon =
				options.avatar && existsSync(options.avatar)
					? nativeImage.createFromPath(options.avatar)
					: undefined;

			new Notification({
				title: options.title,
				body: options.body,
				icon,
			}).show();
		},
	);
}

function registerWatcherHandlers() {
	ipcMain.handle("fs:watch-app-data-path", async (event, relativePath: string) => {
		const { watch } = await import("node:fs");
		const watchId = randomUUID();
		const watchPath = resolveAppDataPath(relativePath);
		await mkdir(watchPath, { recursive: true });

		const watcher = watch(watchPath, (eventType, fileName) => {
			const record = watcherRecords.get(watchId);
			if (!record) {
				return;
			}

			if (record.timeout) {
				clearTimeout(record.timeout);
			}

			record.timeout = setTimeout(() => {
				event.sender.send("fs:watch-app-data-path:changed", {
					watchId,
					eventType,
					paths: fileName ? [join(watchPath, fileName.toString())] : [],
				});
			}, 150);
		});

		watcherRecords.set(watchId, {
			close: () => watcher.close(),
			timeout: null,
		});

		return watchId;
	});

	ipcMain.handle("fs:unwatch-app-data-path", (_event, watchId: string) => {
		const record = watcherRecords.get(watchId);
		if (!record) {
			return;
		}

		if (record.timeout) {
			clearTimeout(record.timeout);
		}
		record.close();
		watcherRecords.delete(watchId);
	});
}

function registerUpdaterHandlers() {
	ipcMain.handle("updater:check", async () => {
		try {
			const updater = await import("electron-updater");
			// Handle different module resolution behaviors (ESM vs CommonJS)
			const autoUpdater = updater.autoUpdater || (updater.default && updater.default.autoUpdater);
			
			autoUpdater.autoDownload = false;
			const result = await autoUpdater.checkForUpdates();

			if (!result?.updateInfo) {
				return null;
			}

			return {
				version: result.updateInfo.version,
				date: result.updateInfo.releaseDate ?? null,
			};
		} catch (error) {
			console.error("Failed to check for updates:", error);
			return null;
		}
	});

	ipcMain.handle("updater:download-and-install", async () => {
		const updater = await import("electron-updater");
		const autoUpdater = updater.autoUpdater || (updater.default && updater.default.autoUpdater);
		
		await autoUpdater.downloadUpdate();
		autoUpdater.quitAndInstall(false, true);
	});
}

app.whenReady().then(() => {
	registerWindowHandlers();
	registerAppHandlers();
	registerFileHandlers();
	registerPathHandlers();
	registerDialogHandlers();
	registerOpenerHandlers();
	registerNotificationHandlers();
	registerWatcherHandlers();
	registerUpdaterHandlers();
	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	for (const record of watcherRecords.values()) {
		if (record.timeout) {
			clearTimeout(record.timeout);
		}
		record.close();
	}
	watcherRecords.clear();

	if (process.platform !== "darwin") {
		app.quit();
	}
});
