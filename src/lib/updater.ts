import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export async function checkForUpdates() {
	try {
		const update = await check();

		if (update) {
			console.log(`Found update ${update.version} from ${update.date}`);

			// Optional: Ask the user if they want to update
			const wantsToUpdate = confirm(
				`Version ${update.version} is available! Update now?`,
			);

			if (wantsToUpdate) {
				let downloaded = 0;
				let contentLength = 0;

				// Download and install the update
				await update.downloadAndInstall((event) => {
					switch (event.event) {
						case "Started":
							contentLength = event.data.contentLength || 0;
							console.log(`Started downloading ${contentLength} bytes`);
							break;
						case "Progress":
							downloaded += event.data.chunkLength;
							console.log(`Downloaded ${downloaded} / ${contentLength}`);
							break;
						case "Finished":
							console.log("Download finished");
							break;
					}
				});

				// Restart the app!
				await relaunch();
			}
		} else {
			console.log("You are on the latest version.");
		}
	} catch (error) {
		console.error("Failed to check for updates:", error);
	}
}
