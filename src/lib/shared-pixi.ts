import { Application } from "pixi.js";

let sharedAppPromise: Promise<Application> | null = null;
let sharedApp: Application | null = null;
let activeOwnerId: string | null = null;
let activeLeaseId = 0;
let nextLeaseId = 0;

async function createSharedApp() {
	const app = new Application();

	await app.init({
		preference: ["webgl", "canvas"],
		antialias: true,
		autoDensity: true,
		autoStart: false,
		backgroundAlpha: 0,
		powerPreference: "high-performance",
		resolution: window.devicePixelRatio || 1,
	});

	const canvas = app.canvas;
	canvas.className = "absolute inset-0 block h-full w-full pointer-events-auto";
	canvas.dataset.layer = "pixi";
	Object.assign(canvas.style, {
		display: "block",
		height: "100%",
		inset: "0",
		pointerEvents: "auto",
		position: "absolute",
		width: "100%",
	});

	sharedApp = app;

	return app;
}

export function getSharedPixiApp() {
	if (!sharedAppPromise) {
		sharedAppPromise = createSharedApp();
	}

	return sharedAppPromise;
}

export async function acquireSharedPixiApp(ownerId: string, host: HTMLElement) {
	const app = await getSharedPixiApp();
	const canvas = app.canvas;
	const leaseId = ++nextLeaseId;

	if (activeOwnerId && activeOwnerId !== ownerId) {
		app.stage.removeChildren();
	}

	activeOwnerId = ownerId;
	activeLeaseId = leaseId;

	if (canvas.parentElement !== host) {
		host.appendChild(canvas);
	}

	return {
		app,
		canvas,
		release: () => {
			if (activeOwnerId !== ownerId || activeLeaseId !== leaseId) {
				return;
			}

			activeOwnerId = null;
			activeLeaseId = 0;
			app.stage.removeChildren();
			canvas.remove();
		},
	};
}

export function getCurrentSharedPixiApp() {
	return sharedApp;
}
