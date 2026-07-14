import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CharacterGraph from "@/components/CharacterGraph";
import CharacterTab from "@/components/Sidebar/CharacterTab";

const mocks = vi.hoisted(() => ({
	history: [
		{
			id: 8,
			relationship_id: "relationship-1",
			from_id: "character-1",
			to_id: "character-2",
			relationship_type_id: "type-1",
			type_label: "Friend",
			description: "Current note",
			value_override: null,
			effective_value: 0.5,
			change_kind: "updated",
			changed_at: "2026-07-14T10:00:00.000Z",
		},
		{
			id: 1,
			relationship_id: "relationship-1",
			from_id: "character-1",
			to_id: "character-2",
			relationship_type_id: "type-1",
			type_label: "Friend",
			description: "Original note",
			value_override: null,
			effective_value: 0.5,
			change_kind: "baseline",
			changed_at: "2026-07-13T10:00:00.000Z",
		},
	],
	markRead: vi.fn(),
	unread: [
		{
			from_id: "character-1",
			latest_version_id: 8,
			relationship_id: "relationship-1",
			unread_count: 1,
		},
	],
}));

const longDescription = "A detailed relationship note. ".repeat(30);
const graphState = {
	addCharacter: vi.fn(),
	addRelationship: vi.fn(),
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
	deleteCharacter: vi.fn(),
	deleteRelationship: vi.fn(),
	relationships: [
		{
			id: "relationship-1",
			fromId: "character-1",
			toId: "character-2",
			typeId: "type-1",
			description: longDescription,
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
	selectedCharId: "character-1",
	setSelectedCharId: vi.fn(),
	updateCharacter: vi.fn(),
	updateRelationship: vi.fn(),
};

vi.mock("@/context/AuthProvider", () => ({
	useAuth: () => ({
		loading: false,
		session: { user: { id: "owner-1" } },
	}),
}));

vi.mock("@/hooks/useRelationshipVersions", () => ({
	useMarkRelationshipVersionsRead: () => ({ mutate: mocks.markRead }),
	useRelationshipHistory: () => ({
		data: mocks.history,
		error: null,
		isPending: false,
	}),
	useUnreadRelationshipVersions: () => ({ data: mocks.unread }),
}));

vi.mock("@/hooks/useSvgPanZoom", () => ({
	useSvgPanZoom: () => ({
		groupRef: { current: null },
		stageRef: { current: null },
		svgRef: { current: null },
		isDragging: false,
		isDraggingRef: { current: false },
		handleWheel: vi.fn(),
		handlePointerDown: vi.fn(),
		handlePointerMove: vi.fn(),
		handlePointerUp: vi.fn(),
		handlePointerCancel: vi.fn(),
	}),
}));

vi.mock("@/store/useGraphStore", () => ({
	useGraphStore: (selector: (state: typeof graphState) => unknown) =>
		selector(graphState),
}));

describe("relationship update notifications", () => {
	beforeEach(() => {
		mocks.markRead.mockReset();
	});

	it("shows a notification dot on the source character", () => {
		render(<CharacterTab />);

		expect(
			screen.getByLabelText("Alice has unread relationship updates"),
		).toBeTruthy();
		expect(
			screen.queryByLabelText("Bob has unread relationship updates"),
		).toBeNull();
	});

	it("shows the relationship dot and marks the row as read when opened", () => {
		render(<CharacterGraph />);

		expect(screen.getByLabelText("Unread relationship update")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /Bob/ }));

		expect(mocks.markRead).toHaveBeenCalledWith({
			relationshipId: "relationship-1",
			latestVersionId: 8,
		});
		const note = screen.getByText((content, element) => {
			return (
				element?.tagName === "P" &&
				content.startsWith("A detailed relationship note")
			);
		});
		expect(note.classList.contains("overflow-y-auto")).toBe(true);
		expect(note.classList.contains("flex-1")).toBe(true);
		const actionRow = screen.getByRole("button", {
			name: "History",
		}).parentElement;
		expect(actionRow?.classList.contains("grid-cols-3")).toBe(true);
		expect(actionRow?.classList.contains("shrink-0")).toBe(true);
	});

	it("shows current and previous relationship versions", () => {
		render(<CharacterGraph />);
		fireEvent.click(screen.getByRole("button", { name: /Bob/ }));
		fireEvent.click(screen.getByRole("button", { name: "History" }));

		expect(screen.getByText("Relationship history")).toBeTruthy();
		expect(screen.getByText("Current")).toBeTruthy();
		expect(screen.getByText("Tracking started")).toBeTruthy();
		expect(screen.getByText("Current note")).toBeTruthy();
		expect(screen.getByText("Original note")).toBeTruthy();
	});
});
