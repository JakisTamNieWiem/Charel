import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

afterEach(() => {
	cleanup();
	localStorage.clear();
	document.head.innerHTML = "";
	document.documentElement.className = "";
});

beforeAll(() => {
	class ResizeObserverMock {
		observe() {}
		disconnect() {}
		unobserve() {}
	}

	globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
	globalThis.createImageBitmap = vi
		.fn()
		.mockImplementation(async () => ({ width: 64, height: 64 }));
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
	globalThis.PointerEvent = MouseEvent as typeof PointerEvent;
	HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
	HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});
