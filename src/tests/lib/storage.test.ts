import { describe, expect, it } from "vitest";
import { parseGraphSnapshot } from "@/lib/storage";

const graphData = {
	characters: [
		{
			id: "character-1",
			name: "Ada",
			description: "",
			avatar: null,
			groupId: null,
			ownerId: "owner-1",
		},
	],
	relationshipTypes: [
		{
			id: "type-1",
			label: "Friend",
			color: "#fff",
			description: "",
			value: 0.5,
		},
	],
	relationships: [
		{
			fromId: "character-1",
			toId: "character-1",
			typeId: "type-1",
			description: "",
			value: null,
		},
	],
	groups: [{ id: "group-1", name: "Allies", color: "#fff" }],
};

describe("graph snapshot parsing", () => {
	it("accepts current and legacy exports", () => {
		expect(parseGraphSnapshot({ version: "2", ...graphData })).toEqual({
			version: "2",
			...graphData,
		});
		expect(
			parseGraphSnapshot({ version: "1.0.0", ...graphData })?.version,
		).toBe("2");
	});

	it("rejects incomplete data", () => {
		expect(parseGraphSnapshot({ version: "2", characters: [] })).toBeNull();
		expect(parseGraphSnapshot(null)).toBeNull();
	});

	it.each([
		["characters", { ...graphData.characters[0], ownerId: 42 }],
		["relationshipTypes", { ...graphData.relationshipTypes[0], value: NaN }],
		["relationships", { ...graphData.relationships[0], fromId: null }],
		["groups", { ...graphData.groups[0], color: false }],
	])("rejects invalid %s rows", (collection, invalidRow) => {
		expect(
			parseGraphSnapshot({
				version: "2",
				...graphData,
				[collection]: [invalidRow],
			}),
		).toBeNull();
	});
});
