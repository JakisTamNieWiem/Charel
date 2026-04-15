import { act, render } from "@testing-library/react";
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
			status: "offline",
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

describe("NetworkGraph", () => {
	beforeEach(() => {
		setSelectedCharId.mockReset();
	});

	it("selects the centered node on click after initial resize", async () => {
		const context = {
			setTransform: vi.fn(),
			clearRect: vi.fn(),
			save: vi.fn(),
			restore: vi.fn(),
			scale: vi.fn(),
			translate: vi.fn(),
			beginPath: vi.fn(),
			arc: vi.fn(),
			fill: vi.fn(),
			stroke: vi.fn(),
			fillText: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			quadraticCurveTo: vi.fn(),
			drawImage: vi.fn(),
			globalAlpha: 1,
			fillStyle: "",
			strokeStyle: "",
			lineWidth: 1,
			font: "",
			textAlign: "center" as const,
			textBaseline: "middle" as const,
			shadowColor: "",
			shadowBlur: 0,
			imageSmoothingEnabled: false,
			imageSmoothingQuality: "low" as const,
		};
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
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
			context as unknown as CanvasRenderingContext2D,
		);
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
		const baseCanvas = container.querySelector(
			"canvas[data-layer='base']",
		) as HTMLCanvasElement;

		await act(async () => {
			resizeCallback?.([{ contentRect: { width: 400, height: 300 } }]);
		});

		await act(async () => {
			baseCanvas.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					clientX: 200,
					clientY: 150,
					pointerId: 1,
				}),
			);
			baseCanvas.dispatchEvent(
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
