import { describe, expect, it } from "vitest";
import {
	buildNetworkLayout,
	findNodeAtPosition,
	getAvatarSpriteSpec,
	getViewportBounds,
	isCircleVisible,
	isLinkVisible,
} from "@/lib/network-graph";
import type {
	Character,
	Group,
	Relationship,
	RelationshipType,
} from "@/types/types";

const characters: Character[] = [
	{
		id: "a",
		name: "Alice",
		description: "",
		avatar: null,
		groupId: "g1",
		ownerId: "owner",
		status: "offline",
	},
	{
		id: "b",
		name: "Bob",
		description: "",
		avatar: null,
		groupId: "g2",
		ownerId: "owner",
		status: "offline",
	},
];

const groups: Group[] = [
	{ id: "g1", name: "Red", color: "#f00" },
	{ id: "g2", name: "Blue", color: "#00f" },
];

const types: RelationshipType[] = [
	{
		id: "friend",
		label: "Friend",
		color: "#0f0",
		description: "",
		value: 1,
	},
];

const relationships: Relationship[] = [
	{
		fromId: "a",
		toId: "b",
		typeId: "friend",
		description: "",
		value: 1,
	},
];

describe("network-graph helpers", () => {
	it("builds global layout with stable node and link counts", () => {
		const layout = buildNetworkLayout(
			characters,
			relationships,
			types,
			groups,
			"global",
		);

		expect(layout.nodes).toHaveLength(2);
		expect(layout.links).toHaveLength(1);
		expect(layout.groups).toHaveLength(0);
		expect(layout.links[0].cpX).toBeTypeOf("number");
		expect(layout.links[0].cpY).toBeTypeOf("number");
	});

	it("keeps single-node grouped layout centered and hit-testable", () => {
		const layout = buildNetworkLayout(
			[characters[0]],
			[],
			types,
			[groups[0]],
			"group",
		);

		expect(layout.nodes[0]).toMatchObject({
			x: 0,
			y: 0,
			groupCx: 0,
			groupCy: 0,
		});
		expect(findNodeAtPosition(layout.nodes, 0, 0)?.id).toBe("a");
		expect(findNodeAtPosition(layout.nodes, 100, 100)).toBeNull();
	});

	it("computes viewport visibility and avatar tiers", () => {
		const bounds = getViewportBounds({ x: 200, y: 150, k: 0.5 }, 400, 300);
		const layout = buildNetworkLayout(
			characters,
			relationships,
			types,
			groups,
			"global",
		);

		expect(isCircleVisible(bounds, 0, 0, 20)).toBe(true);
		expect(isLinkVisible(bounds, layout.links[0], 32)).toBe(true);

		const interactive = getAvatarSpriteSpec(
			"avatar.png",
			"interactive",
			0.5,
			1,
		);
		const settled = getAvatarSpriteSpec("avatar.png", "settled", 0.5, 1);

		expect(settled.size).toBeGreaterThanOrEqual(interactive.size);
		expect(settled.cacheKey).not.toBe(interactive.cacheKey);
	});
});
