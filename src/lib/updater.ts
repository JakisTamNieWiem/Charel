import { getDesktopApi } from "@/lib/desktop";

export async function checkForUpdates() {
	try {
		const desktop = getDesktopApi();
		if (!desktop) {
			return;
		}

		const update = await desktop.updater.check();

		if (update) {
			console.log(`Found update ${update.version} from ${update.date}`);

			// Optional: Ask the user if they want to update
			const wantsToUpdate = confirm(
				`Version ${update.version} is available! Update now?`,
			);

			if (wantsToUpdate) {
				await desktop.updater.downloadAndInstall();
				await desktop.app.relaunch();
			}
		} else {
			console.log("You are on the latest version.");
		}
	} catch (error) {
		console.error("Failed to check for updates:", error);
	}
}
