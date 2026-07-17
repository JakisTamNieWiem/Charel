import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RelationshipModal from "@/components/RelationshipModal";

const graphState = {
	characters: [
		{
			id: "character-1",
			name: "Alice",
			description: "",
			avatar: null,
			groupId: null,
			ownerId: "owner-1",
		},
		{
			id: "character-2",
			name: "Bob",
			description: "",
			avatar: null,
			groupId: null,
			ownerId: "owner-2",
		},
	],
	relationshipTypes: [
		{
			id: "type-1",
			label: "Friend",
			color: "#22c55e",
			description: "",
			value: 0.5,
		},
	],
};

vi.mock("@/store/useGraphStore", () => ({
	useGraphStore: (selector: (state: typeof graphState) => unknown) =>
		selector(graphState),
}));

function renderModal(description = "Secret note") {
	return render(
		<RelationshipModal
			fromId="character-1"
			initialData={{
				id: "relationship-1",
				fromId: "character-1",
				toId: "character-2",
				typeId: "type-1",
				description,
				value: null,
			}}
			onSave={vi.fn()}
			open={true}
			onOpenChange={vi.fn()}
		/>,
	);
}

function mockAnimationFrames() {
	const callbacks: FrameRequestCallback[] = [];
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
		callbacks.push(callback),
	);
	return callbacks;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("relationship description color controls", () => {
	it("shows all colors and wraps selected text", () => {
		const animationFrames = mockAnimationFrames();
		renderModal();

		expect(
			screen.getAllByRole("button", {
				name: /Apply [A-Z]+ text color/,
			}),
		).toHaveLength(16);

		const description = screen.getByLabelText(
			"Description",
		) as HTMLTextAreaElement;
		description.focus();
		description.setSelectionRange(0, 6);
		animationFrames.length = 0;
		fireEvent.click(
			screen.getByRole("button", { name: "Apply RED text color" }),
		);

		expect(description.value).toBe("[RED]Secret[/RED] note");
		act(() => {
			for (const callback of animationFrames) callback(0);
		});
		expect(description.selectionStart).toBe(17);
		expect(description.selectionEnd).toBe(17);
	});

	it("inserts empty tags with the caret between them", () => {
		const animationFrames = mockAnimationFrames();
		renderModal();

		const description = screen.getByLabelText(
			"Description",
		) as HTMLTextAreaElement;
		description.focus();
		description.setSelectionRange(6, 6);
		animationFrames.length = 0;
		fireEvent.click(
			screen.getByRole("button", { name: "Apply BLUE text color" }),
		);

		expect(description.value).toBe("Secret[BLUE][/BLUE] note");
		act(() => {
			for (const callback of animationFrames) callback(0);
		});
		expect(description.selectionStart).toBe(12);
		expect(description.selectionEnd).toBe(12);
	});
});
