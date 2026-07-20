import { act, fireEvent, render, screen } from "@testing-library/react";
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
		{
			id: "character-3",
			name: "Charlie",
			description: "",
			avatar: null,
			groupId: null,
			ownerId: "owner-3",
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
		mocks.unread.splice(0, mocks.unread.length, {
			from_id: "character-1",
			latest_version_id: 8,
			relationship_id: "relationship-1",
			unread_count: 1,
		});
		graphState.relationships.splice(1);
		graphState.relationshipTypes.splice(1);
		graphState.selectedCharId = "character-1";
		graphState.setSelectedCharId.mockReset();
	});

	it("shows a notification dot on the source character", () => {
		render(<CharacterTab />);

		const notificationDot = screen.getByLabelText(
			"Alice has unread relationship updates",
		);
		expect(notificationDot.classList.contains("bg-primary")).toBe(true);
		expect(
			screen.queryByLabelText("Bob has unread relationship updates"),
		).toBeNull();
	});

	it("renders relationship types in an accessible compact rail", () => {
		render(<CharacterGraph />);

		const legend = screen.getByRole("list", { name: "Relationship types" });
		expect(legend.classList).toContain("overflow-y-auto");
		expect(legend.classList).toContain("top-1/2");
		expect(legend.classList).toContain("-translate-y-1/2");

		const friendType = screen.getByLabelText("Friend relationship type");
		expect(friendType.tabIndex).toBe(0);
		expect(friendType.textContent).toContain("Friend");
	});

	it("filters characters by name", () => {
		render(<CharacterTab />);

		const searchInput = screen.getByLabelText("Search characters");
		const stickySearch = searchInput.parentElement?.parentElement;
		expect(stickySearch?.classList).toContain("sticky");
		expect(stickySearch?.classList).toContain("top-[3.25rem]");
		expect(stickySearch?.parentElement?.parentElement?.classList).toContain(
			"gap-0",
		);

		fireEvent.change(searchInput, {
			target: { value: "bob" },
		});

		expect(screen.getByText("Bob")).toBeTruthy();
		expect(screen.queryByText("Alice")).toBeNull();
	});

	it("lists unread changes and exposes explicit actions", () => {
		render(<CharacterTab />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Unread relationship changes: 1",
			}),
		);

		expect(
			screen.getByRole("heading", { name: "Unread relationship changes" }),
		).toBeTruthy();
		expect(screen.getByText("Alice → Bob")).toBeTruthy();
		expect(screen.getByText("Friend")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
		expect(mocks.markRead).toHaveBeenCalledWith({
			relationshipId: "relationship-1",
			latestVersionId: 8,
		});

		fireEvent.click(screen.getByRole("button", { name: "Show character" }));
		expect(graphState.setSelectedCharId).toHaveBeenCalledWith("character-1");
	});

	it("marks every unread relationship as read", () => {
		graphState.relationships.push({
			id: "relationship-2",
			fromId: "character-3",
			toId: "character-2",
			typeId: "type-1",
			description: "",
			value: null,
		});
		mocks.unread.push({
			from_id: "character-3",
			latest_version_id: 9,
			relationship_id: "relationship-2",
			unread_count: 1,
		});

		render(<CharacterTab />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Unread relationship changes: 2",
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

		expect(mocks.markRead).toHaveBeenCalledTimes(2);
		expect(mocks.markRead).toHaveBeenNthCalledWith(1, {
			relationshipId: "relationship-1",
			latestVersionId: 8,
		});
		expect(mocks.markRead).toHaveBeenNthCalledWith(2, {
			relationshipId: "relationship-2",
			latestVersionId: 9,
		});
	});

	it("shows the relationship dot and marks the row as read when opened", () => {
		render(<CharacterGraph />);

		const graphNotification = screen.getByTestId(
			"graph-notification-character-2",
		);
		const notificationCircle = graphNotification.querySelector("circle");
		expect(notificationCircle?.classList.contains("fill-primary")).toBe(true);
		expect(Number(notificationCircle?.getAttribute("cx"))).toBeCloseTo(28);
		expect(Number(notificationCircle?.getAttribute("cy"))).toBeCloseTo(-248);
		expect(
			screen.queryByTestId("graph-notification-relationship-relationship-1"),
		).toBeNull();
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

	it("places every incoming unread relationship on the center circumference", () => {
		graphState.selectedCharId = "character-2";
		graphState.relationshipTypes.push({
			id: "type-2",
			label: "Rival",
			color: "#ef4444",
			description: "",
			value: -0.5,
		});
		graphState.relationships.push(
			{
				id: "relationship-2",
				fromId: "character-3",
				toId: "character-2",
				typeId: "type-1",
				description: "",
				value: null,
			},
			{
				id: "relationship-3",
				fromId: "character-1",
				toId: "character-2",
				typeId: "type-2",
				description: "",
				value: null,
			},
			{
				id: "relationship-4",
				fromId: "character-3",
				toId: "character-2",
				typeId: "type-2",
				description: "",
				value: null,
			},
		);
		mocks.unread.push(
			{
				from_id: "character-3",
				latest_version_id: 9,
				relationship_id: "relationship-2",
				unread_count: 1,
			},
			{
				from_id: "character-1",
				latest_version_id: 10,
				relationship_id: "relationship-3",
				unread_count: 1,
			},
		);

		render(<CharacterGraph />);

		const aliceFriend = screen.getByTestId(
			"graph-notification-relationship-relationship-1",
		);
		const charlieFriend = screen.getByTestId(
			"graph-notification-relationship-relationship-2",
		);
		const aliceRival = screen.getByTestId(
			"graph-notification-relationship-relationship-3",
		);

		expect(
			screen.getAllByLabelText("Alice changed a relationship to Bob"),
		).toHaveLength(2);
		expect(
			screen.getByLabelText("Charlie changed a relationship to Bob"),
		).toBeTruthy();
		expect(screen.queryByTestId("graph-notification-character-2")).toBeNull();
		expect(
			screen.queryByTestId("graph-notification-relationship-relationship-4"),
		).toBeNull();

		for (const notification of [aliceFriend, charlieFriend, aliceRival]) {
			const circle = notification.querySelector("circle");
			const x = Number(circle?.getAttribute("cx"));
			const y = Number(circle?.getAttribute("cy"));
			expect(Math.hypot(x, y)).toBeCloseTo(82);
		}

		expect(aliceFriend.getAttribute("transform")).toBe(
			aliceRival.getAttribute("transform"),
		);
		expect(aliceFriend.querySelector("circle")?.getAttribute("cy")).not.toBe(
			aliceRival.querySelector("circle")?.getAttribute("cy"),
		);
		expect(charlieFriend.getAttribute("transform")).not.toBe(
			aliceFriend.getAttribute("transform"),
		);
		expect(charlieFriend.querySelector("circle")?.getAttribute("cy")).toBe("0");
	});

	it("keeps the read delay running while the relationship is open", () => {
		vi.useFakeTimers();
		try {
			render(<CharacterGraph />);
			const relationshipPath = screen.getByTestId(
				"relationship-hover-relationship-1",
			);

			fireEvent.mouseEnter(relationshipPath);
			act(() => vi.advanceTimersByTime(699));
			expect(mocks.markRead).not.toHaveBeenCalled();

			fireEvent.mouseLeave(relationshipPath);
			act(() => vi.advanceTimersByTime(1));
			expect(mocks.markRead).toHaveBeenCalledWith({
				relationshipId: "relationship-1",
				latestVersionId: 8,
			});
		} finally {
			vi.useRealTimers();
		}
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
