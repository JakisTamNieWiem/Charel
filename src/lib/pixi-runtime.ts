import { Application, type Container } from "pixi.js";

type RuntimeAttachment = {
	app: Application;
	canvas: HTMLCanvasElement;
	token: number;
};

export type PixiScene = {
	id: string;
	root: Container;
	activate?: (attachment: RuntimeAttachment) => void;
	deactivate?: () => void;
	resize?: (width: number, height: number, resolution: number) => void;
};

type ActiveRoot = {
	id: string;
	root: Container;
};

class SharedPixiRuntime {
	private app: Application | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private initPromise: Promise<RuntimeAttachment> | null = null;
	private host: HTMLElement | null = null;
	private activeRoot: ActiveRoot | null = null;
	private attachToken = 0;
	private activeAttachToken = 0;

	async attach(host: HTMLElement): Promise<RuntimeAttachment> {
		const token = this.attachToken + 1;
		this.attachToken = token;
		const attachment = await this.ensure();
		const nextAttachment = { ...attachment, token };

		if (token !== this.attachToken) {
			return nextAttachment;
		}

		if (this.host !== host) {
			this.detach();
			this.host = host;
			host.appendChild(nextAttachment.canvas);
		} else if (nextAttachment.canvas.parentElement !== host) {
			host.appendChild(nextAttachment.canvas);
		}

		this.activeAttachToken = token;

		return nextAttachment;
	}

	detach(host?: HTMLElement, token?: number) {
		if (token && this.activeAttachToken !== token) {
			return;
		}

		if (host && this.host !== host) {
			return;
		}

		if (this.canvas?.parentElement) {
			this.canvas.parentElement.removeChild(this.canvas);
		}

		this.host = null;
		this.activeAttachToken = 0;
	}

	activateRoot(id: string, root: Container) {
		const app = this.app;

		if (!app) {
			return;
		}

		if (this.activeRoot?.id === id && this.activeRoot.root === root) {
			if (!root.parent) {
				app.stage.addChild(root);
			}
			return;
		}

		if (this.activeRoot?.root.parent === app.stage) {
			app.stage.removeChild(this.activeRoot.root);
		}

		this.activeRoot = { id, root };

		if (!root.parent) {
			app.stage.addChild(root);
		}
	}

	deactivateRoot(id: string) {
		const app = this.app;

		if (!app || this.activeRoot?.id !== id) {
			return;
		}

		if (this.activeRoot.root.parent === app.stage) {
			app.stage.removeChild(this.activeRoot.root);
		}

		this.activeRoot = null;
	}

	resize(
		width: number,
		height: number,
		resolution = window.devicePixelRatio || 1,
	) {
		const app = this.app;
		const canvas = this.canvas;

		if (!app || !canvas) {
			return;
		}

		app.renderer.resize(width, height, resolution);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
	}

	render() {
		this.app?.render();
	}

	private ensure(): Promise<RuntimeAttachment> {
		if (this.app && this.canvas) {
			return Promise.resolve({
				app: this.app,
				canvas: this.canvas,
				token: this.activeAttachToken,
			});
		}

		if (this.initPromise) {
			return this.initPromise;
		}

		const app = new Application();

		this.initPromise = app
			.init({
				preference: ["webgl", "canvas"],
				antialias: true,
				autoDensity: true,
				autoStart: false,
				backgroundAlpha: 0,
				powerPreference: "high-performance",
				resolution: window.devicePixelRatio || 1,
			})
			.then(() => {
				this.app = app;
				this.canvas = app.canvas;
				this.canvas.dataset.layer = "pixi";
				this.canvas.className =
					"absolute inset-0 block h-full w-full pointer-events-auto";
				this.canvas.setAttribute("aria-label", "Pixi scene");
				return { app, canvas: this.canvas, token: this.activeAttachToken };
			})
			.catch((error) => {
				this.initPromise = null;
				console.error("Failed to initialize shared Pixi runtime", error);
				throw error;
			});

		return this.initPromise;
	}
}

export const sharedPixiRuntime = new SharedPixiRuntime();
