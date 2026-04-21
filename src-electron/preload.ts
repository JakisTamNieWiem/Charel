import { contextBridge, ipcRenderer } from "electron";

type FileFilter = {
	name: string;
	extensions: string[];
};

const desktopApi = {
	platform: "electron" as const,
	app: {
		getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>,
		relaunch: () => ipcRenderer.invoke("app:relaunch") as Promise<void>,
	},
	window: {
		minimize: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
		toggleMaximize: () =>
			ipcRenderer.invoke("window:toggle-maximize") as Promise<void>,
		close: () => ipcRenderer.invoke("window:close") as Promise<void>,
	},
	path: {
		appDataDir: () => ipcRenderer.invoke("path:app-data-dir") as Promise<string>,
		tempDir: () => ipcRenderer.invoke("path:temp-dir") as Promise<string>,
		join: (...parts: string[]) =>
			ipcRenderer.invoke("path:join", ...parts) as Promise<string>,
	},
	fs: {
		existsAppData: (relativePath: string) =>
			ipcRenderer.invoke("fs:exists-app-data", relativePath) as Promise<boolean>,
		mkdirAppData: (relativePath: string) =>
			ipcRenderer.invoke("fs:mkdir-app-data", relativePath) as Promise<void>,
		readAppDataDir: (relativePath: string) =>
			ipcRenderer.invoke("fs:read-app-data-dir", relativePath) as Promise<
				{
					name: string;
					isFile: boolean;
					isDirectory: boolean;
				}[]
			>,
		readAppDataTextFile: (relativePath: string) =>
			ipcRenderer.invoke(
				"fs:read-app-data-text-file",
				relativePath,
			) as Promise<string>,
		writeAppDataTextFile: (relativePath: string, contents: string) =>
			ipcRenderer.invoke(
				"fs:write-app-data-text-file",
				relativePath,
				contents,
			) as Promise<void>,
		removeAppDataPath: (relativePath: string) =>
			ipcRenderer.invoke("fs:remove-app-data-path", relativePath) as Promise<void>,
		pathExists: (path: string) =>
			ipcRenderer.invoke("fs:path-exists", path) as Promise<boolean>,
		mkdir: (path: string) => ipcRenderer.invoke("fs:mkdir", path) as Promise<void>,
		readTextFile: (path: string) =>
			ipcRenderer.invoke("fs:read-text-file", path) as Promise<string>,
		writeTextFile: (path: string, contents: string) =>
			ipcRenderer.invoke("fs:write-text-file", path, contents) as Promise<void>,
		writeFile: (path: string, bytes: Uint8Array) =>
			ipcRenderer.invoke("fs:write-file", path, bytes) as Promise<void>,
		watchAppDataPath: async (
			relativePath: string,
			onChange: (event: { paths: string[]; eventType: string }) => void,
		) => {
			const watchId = (await ipcRenderer.invoke(
				"fs:watch-app-data-path",
				relativePath,
			)) as string;
			const listener = (
				_event: Electron.IpcRendererEvent,
				payload: { watchId: string; paths: string[]; eventType: string },
			) => {
				if (payload.watchId === watchId) {
					onChange({
						paths: payload.paths,
						eventType: payload.eventType,
					});
				}
			};

			ipcRenderer.on("fs:watch-app-data-path:changed", listener);

			return async () => {
				ipcRenderer.off("fs:watch-app-data-path:changed", listener);
				await ipcRenderer.invoke("fs:unwatch-app-data-path", watchId);
			};
		},
	},
	dialog: {
		openFile: (options: { title?: string; filters?: FileFilter[] }) =>
			ipcRenderer.invoke("dialog:open-file", options) as Promise<string | null>,
		saveFile: (options: { defaultPath?: string; filters?: FileFilter[] }) =>
			ipcRenderer.invoke("dialog:save-file", options) as Promise<string | null>,
	},
	opener: {
		openPath: (path: string) =>
			ipcRenderer.invoke("opener:open-path", path) as Promise<string>,
	},
	notification: {
		isPermissionGranted: () =>
			ipcRenderer.invoke("notification:is-permission-granted") as Promise<boolean>,
		requestPermission: () =>
			ipcRenderer.invoke("notification:request-permission") as Promise<
				"granted" | "denied"
			>,
		send: (options: { title: string; body: string; avatar?: string | null }) =>
			ipcRenderer.invoke("notification:send", options) as Promise<void>,
	},
	updater: {
		check: () =>
			ipcRenderer.invoke("updater:check") as Promise<{
				version: string;
				date: string | null;
			} | null>,
		downloadAndInstall: () =>
			ipcRenderer.invoke("updater:download-and-install") as Promise<void>,
	},
};

contextBridge.exposeInMainWorld("charelDesktop", desktopApi);
