import { describe, expect, it } from "vitest";
import { applyRelationshipChange, applyRowChange } from "@/lib/realtime-graph";
import type { Relationship } from "@/types/types";

describe("realtime graph reducers", () => {
	it("upserts and deletes rows without duplicating optimistic inserts", () => {
		type Row = { id: string; name: string };
		const rows: Row[] = [{ id: "a", name: "Alpha" }];

		expect(
			applyRowChange<Row>(rows, {
				eventType: "INSERT",
				new: { id: "a", name: "Alpha" },
				old: {},
			}),
		).toEqual(rows);
		expect(
			applyRowChange<Row>(rows, {
				eventType: "UPDATE",
				new: { id: "b", name: "Beta" },
				old: { id: "a" },
			}),
		).toEqual([{ id: "b", name: "Beta" }]);
		expect(
			applyRowChange<Row>(rows, {
				eventType: "DELETE",
				new: {},
				old: { id: "a", name: "Alpha" },
			}),
		).toEqual([]);
	});

	it("preserves fields omitted from realtime updates", () => {
		type CharacterRow = {
			id: string;
			avatar: string;
			groupId: string | null;
			ownerId: string;
		};
		const character: CharacterRow = {
			id: "character-1",
			avatar: "data:image/webp;base64,avatar",
			groupId: null,
			ownerId: "owner-1",
		};

		expect(
			applyRowChange([character], {
				eventType: "UPDATE",
				new: {
					id: character.id,
					groupId: "group-1",
					ownerId: "owner-2",
				} as CharacterRow,
				old: { id: character.id },
			}),
		).toEqual([
			{
				...character,
				groupId: "group-1",
				ownerId: "owner-2",
			},
		]);
	});

	it("uses the previous relationship key when an update changes it", () => {
		const relationship: Relationship = {
			fromId: "a",
			toId: "b",
			typeId: "friend",
			description: "",
			value: null,
		};
		const updated = { ...relationship, toId: "c" };

		expect(
			applyRelationshipChange([relationship], {
				eventType: "UPDATE",
				new: updated,
				old: relationship,
			}),
		).toEqual([updated]);
	});

	it("uses a stable id when relationship fields change", () => {
		const relationship: Relationship = {
			id: "relationship-1",
			fromId: "a",
			toId: "b",
			typeId: "friend",
			description: "Old",
			value: null,
		};
		const updated = {
			...relationship,
			toId: "c",
			description: "New",
		};

		expect(
			applyRelationshipChange([relationship], {
				eventType: "UPDATE",
				new: updated,
				old: { id: relationship.id },
			}),
		).toEqual([updated]);
	});
});
