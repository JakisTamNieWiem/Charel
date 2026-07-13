import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGraphHistoryShortcuts } from "@/hooks/useGraphHistoryShortcuts";
import { useGraphStore } from "@/store/useGraphStore";

function ShortcutProbe({ enabled = true }: { enabled?: boolean }) {
	useGraphHistoryShortcuts(enabled);
	return <input aria-label="Editor" />;
}

describe("graph history shortcuts", () => {
	afterEach(() => vi.restoreAllMocks());

	it("handles undo and redo with Ctrl or Command", () => {
		const history = useGraphStore.temporal.getState();
		const undo = vi.spyOn(history, "undo").mockImplementation(() => {});
		const redo = vi.spyOn(history, "redo").mockImplementation(() => {});
		render(<ShortcutProbe />);

		fireEvent.keyDown(window, { key: "z", ctrlKey: true });
		fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true });

		expect(undo).toHaveBeenCalledOnce();
		expect(redo).toHaveBeenCalledOnce();
	});

	it("ignores editable targets and disabled shortcuts", () => {
		const undo = vi
			.spyOn(useGraphStore.temporal.getState(), "undo")
			.mockImplementation(() => {});
		const { getByRole, rerender } = render(<ShortcutProbe />);

		fireEvent.keyDown(getByRole("textbox"), { key: "z", ctrlKey: true });
		rerender(<ShortcutProbe enabled={false} />);
		fireEvent.keyDown(window, { key: "z", ctrlKey: true });

		expect(undo).not.toHaveBeenCalled();
	});
});
