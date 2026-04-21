export type DesktopFileEntry = {
	name: string;
	isFile: boolean;
	isDirectory: boolean;
};

export type DesktopFileFilter = {
	name: string;
	extensions: string[];
};

export type DesktopUnwatchFn = () => void | Promise<void>;

export type CharelDesktopApi = {
	platform: "electron";
	app: {
		getVersion: () => Promise<string>;
		relaunch: () => Promise<void>;
	};
	window: {
		minimize: () => Promise<void>;
		toggleMaximize: () => Promise<void>;
		close: () => Promise<void>;
	};
	path: {
		appDataDir: () => Promise<string>;
		tempDir: () => Promise<string>;
		join: (...parts: string[]) => Promise<string>;
	};
	fs: {
		existsAppData: (relativePath: string) => Promise<boolean>;
		mkdirAppData: (relativePath: string) => Promise<void>;
		readAppDataDir: (relativePath: string) => Promise<DesktopFileEntry[]>;
		readAppDataTextFile: (relativePath: string) => Promise<string>;
		writeAppDataTextFile: (
			relativePath: string,
			contents: string,
		) => Promise<void>;
		removeAppDataPath: (relativePath: string) => Promise<void>;
		pathExists: (path: string) => Promise<boolean>;
		mkdir: (path: string) => Promise<void>;
		readTextFile: (path: string) => Promise<string>;
		writeTextFile: (path: string, contents: string) => Promise<void>;
		writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
		watchAppDataPath: (
			relativePath: string,
			onChange: (event: { paths: string[]; eventType: string }) => void,
		) => Promise<DesktopUnwatchFn>;
	};
	dialog: {
		openFile: (options: {
			title?: string;
			filters?: DesktopFileFilter[];
		}) => Promise<string | null>;
		saveFile: (options: {
			defaultPath?: string;
			filters?: DesktopFileFilter[];
		}) => Promise<string | null>;
	};
	opener: {
		openPath: (path: string) => Promise<string>;
	};
	notification: {
		isPermissionGranted: () => Promise<boolean>;
		requestPermission: () => Promise<"granted" | "denied">;
		send: (options: {
			title: string;
			body: string;
			avatar?: string | null;
		}) => Promise<void>;
	};
	updater: {
		check: () => Promise<{ version: string; date: string | null } | null>;
		downloadAndInstall: () => Promise<void>;
	};
};

declare global {
	interface Window {
		charelDesktop?: CharelDesktopApi;
	}
}

export function getDesktopApi() {
	return typeof window === "undefined" ? undefined : window.charelDesktop;
}

export function isDesktop() {
	return Boolean(getDesktopApi());
}
