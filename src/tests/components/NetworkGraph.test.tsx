import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NetworkGraph from "@/components/NetworkGraph";

const setSelectedCharId = vi.fn();

const graphState = {
	characters: [
		{
			id: "char-1",
			name: "Alice",
			description: "",
			avatar: null,
			groupId: "group-1",
			ownerId: "owner",
		},
	],
	relationships: [],
	relationshipTypes: [],
	groups: [{ id: "group-1", name: "Crew", color: "#ff0000" }],
	networkMode: "group" as const,
	setSelectedCharId,
};

vi.mock("@/store/useGraphStore", () => ({
	useGraphStore: (selector: (state: typeof graphState) => unknown) =>
		selector(graphState),
}));

vi.mock("pixi.js", () => {
	class PointMock {
		x = 0;
		y = 0;

		set(x: number, y = x) {
			this.x = x;
			this.y = y;
		}
	}

	class ContainerMock {
		alpha = 1;
		children: ContainerMock[] = [];
		mask: ContainerMock | null = null;
		position = new PointMock();
		scale = new PointMock();
		x = 0;
		y = 0;

		addChild(...children: ContainerMock[]) {
			this.children.push(...children);
			return children[0];
		}

		removeChildren() {
			const children = this.children;
			this.children = [];
			return children;
		}

		destroy() {}
	}

	class GraphicsMock extends ContainerMock {
		beginPath() {
			return this;
		}

		circle() {
			return this;
		}

		clear() {
			return this;
		}

		fill() {
			return this;
		}

		lineTo() {
			return this;
		}

		moveTo() {
			return this;
		}

		quadraticCurveTo() {
			return this;
		}

		stroke() {
			return this;
		}
	}

	class SpriteMock extends ContainerMock {
		anchor = new PointMock();
		height = 0;
		texture: { height: number; width: number };
		width = 0;

		constructor(texture = { height: 1, width: 1 }) {
			super();
			this.texture = texture;
		}
	}

	class TextureMock {
		height = 1;
		width = 1;

		static from() {
			return new TextureMock();
		}
	}

	class TextMock extends ContainerMock {
		anchor = new PointMock();
		text = "";

		constructor(options?: { text?: string }) {
			super();
			this.text = options?.text ?? "";
		}
	}

	class ApplicationMock {
		canvas: HTMLCanvasElement = document.createElement("canvas");
		renderer = { resize() {} };
		stage = new ContainerMock();

		async init(options?: { canvas?: HTMLCanvasElement }) {
			this.canvas = options?.canvas ?? this.canvas;
		}

		destroy() {}

		render() {}
	}

	return {
		Application: ApplicationMock,
		Container: ContainerMock,
		Graphics: GraphicsMock,
		Sprite: SpriteMock,
		Text: TextMock,
		Texture: TextureMock,
	};
});

describe("NetworkGraph", () => {
	beforeEach(() => {
		setSelectedCharId.mockReset();
	});

	it("selects the centered node on click after initial resize", async () => {
		let resizeCallback:
			| ((
					entries: Array<{ contentRect: { width: number; height: number } }>,
			  ) => void)
			| null = null;

		class ResizeObserverMock {
			constructor(
				callback: (
					entries: Array<{ contentRect: { width: number; height: number } }>,
				) => void,
			) {
				resizeCallback = callback;
			}
			observe() {}
			disconnect() {}
			unobserve() {}
		}

		vi.stubGlobal("ResizeObserver", ResizeObserverMock);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 1;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
		vi.spyOn(
			HTMLCanvasElement.prototype,
			"getBoundingClientRect",
		).mockReturnValue({
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			top: 0,
			left: 0,
			right: 400,
			bottom: 300,
			toJSON: () => ({}),
		});

		const { container } = render(<NetworkGraph />);
		let pixiCanvas: HTMLCanvasElement | null = null;

		await waitFor(() => {
			pixiCanvas = container.querySelector("canvas[data-layer='pixi']");
			expect(pixiCanvas).not.toBeNull();
			expect(resizeCallback).not.toBeNull();
		});

		await act(async () => {
			resizeCallback?.([{ contentRect: { width: 400, height: 300 } }]);
		});

		await act(async () => {
			pixiCanvas?.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					clientX: 200,
					clientY: 150,
					pointerId: 1,
				}),
			);
			pixiCanvas?.dispatchEvent(
				new PointerEvent("pointerup", {
					bubbles: true,
					clientX: 200,
					clientY: 150,
					pointerId: 1,
				}),
			);
		});

		expect(setSelectedCharId).toHaveBeenCalledWith("char-1");
	});
});
