import { describe, expect, it } from "vitest";
import { buildNetworkStats } from "@/lib/network-stats";
import type { GraphData } from "@/types/types";

const characters = [
	{
		id: "a",
		name: "Ada",
		avatar: null,
		groupId: "g",
		description: "",
		ownerId: "o",
	},
	{
		id: "b",
		name: "Bea",
		avatar: null,
		groupId: "g",
		description: "",
		ownerId: "o",
	},
	{
		id: "c",
		name: "Cal",
		avatar: null,
		groupId: null,
		description: "",
		ownerId: "o",
	},
	{
		id: "d",
		name: "Dee",
		avatar: null,
		groupId: null,
		description: "",
		ownerId: "o",
	},
];

function graph(relationships: GraphData["relationships"]): GraphData {
	return {
		characters,
		relationships,
		relationshipTypes: [
			{
				id: "friend",
				label: "Friend",
				color: "#fff",
				description: "",
				value: 0.8,
			},
		],
		groups: [{ id: "g", name: "Group", color: "#fff" }],
	};
}

describe("buildNetworkStats", () => {
	it("separates incoming sentiment from bidirectional connectivity", () => {
		const stats = buildNetworkStats(
			graph([
				{
					fromId: "a",
					toId: "b",
					typeId: "friend",
					description: "",
					value: null,
				},
				{
					fromId: "a",
					toId: "c",
					typeId: "friend",
					description: "",
					value: -0.4,
				},
			]),
		);

		expect(
			stats.charStats.map(({ id, connectionCount }) => [id, connectionCount]),
		).toEqual([
			["a", 2],
			["b", 1],
			["c", 1],
			["d", 0],
		]);
		expect(stats.mostLikeable?.id).toBe("b");
		expect(stats.mostDisliked?.id).toBe("c");
		expect(stats.leastConnected?.id).toBe("d");
	});

	it("preserves pair, reciprocity, and group aggregates", () => {
		const stats = buildNetworkStats(
			graph([
				{
					fromId: "a",
					toId: "b",
					typeId: "friend",
					description: "",
					value: null,
				},
				{
					fromId: "b",
					toId: "a",
					typeId: "friend",
					description: "",
					value: 0.2,
				},
			]),
		);

		expect(stats.bestRel).toEqual({ from: "Ada", to: "Bea", value: 0.5 });
		expect(stats.reciprocity).toBe(1);
		expect(stats.density).toBeCloseTo(1 / 6);
		expect(stats.groupStats[0]).toMatchObject({
			memberCount: 2,
			internalRelations: 2,
			avgValue: 0.5,
		});
	});
});
