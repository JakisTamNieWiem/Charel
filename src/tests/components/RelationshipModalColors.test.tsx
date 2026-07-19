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
		{
			id: "character-3",
			name: "Charlie",
			description: "",
			avatar: null,
			groupId: null,
			ownerId: "owner-3",
		},
	],
	relationships: [
		{
			id: "relationship-1",
			fromId: "character-1",
			toId: "character-2",
			typeId: "type-1",
			description: "",
			value: null,
		},
		{
			id: "relationship-2",
			fromId: "character-3",
			toId: "character-1",
			typeId: "type-1",
			description: "",
			value: null,
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

function renderNewModal() {
	return render(
		<RelationshipModal
			fromId="character-1"
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

describe("RelationshipModal", () => {
	it("keeps long descriptions inside a scrollable dialog", () => {
		const longDescription = "Long relationship note. ".repeat(200);
		renderModal(longDescription);

		const description = screen.getByLabelText(
			"Description",
		) as HTMLTextAreaElement;
		const dialog = description.closest('[data-slot="dialog-content"]');
		const fieldGroup = dialog?.querySelector('[data-slot="field-group"]');

		expect(description.value).toBe(longDescription);
		expect(description.classList).toContain("max-h-48");
		expect(description.classList).toContain("resize-y");
		expect(description.classList).toContain("overflow-y-auto");
		expect(dialog?.classList).toContain("max-h-[calc(100vh-2rem)]");
		expect(dialog?.classList).toContain("overflow-hidden");
		expect(fieldGroup?.classList).toContain("min-h-0");
		expect(fieldGroup?.classList).toContain("overflow-y-auto");
	});

	it("excludes existing outgoing relationship targets when creating", () => {
		renderNewModal();

		const target = screen.getByPlaceholderText(
			"Select a character",
		) as HTMLInputElement;
		expect(target.value).toBe("Charlie");
	});

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
