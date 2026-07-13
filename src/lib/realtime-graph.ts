import type { Relationship } from "@/types/types";

export type RowChange<T> =
	| { eventType: "INSERT"; new: T; old: Partial<T> }
	| { eventType: "UPDATE"; new: T; old: Partial<T> }
	| { eventType: "DELETE"; new: Partial<T>; old: T };

export function applyRowChange<T extends { id: string }>(
	rows: T[],
	change: RowChange<T>,
) {
	if (change.eventType === "DELETE") {
		return rows.filter((row) => row.id !== change.old.id);
	}

	const previousId = change.old.id ?? change.new.id;
	const index = rows.findIndex((row) => row.id === previousId);
	if (index === -1) return [...rows, change.new];

	return rows.map((row, rowIndex) => (rowIndex === index ? change.new : row));
}

function isSameRelationship(
	left: Partial<Relationship>,
	right: Partial<Relationship>,
) {
	return (
		left.fromId === right.fromId &&
		left.toId === right.toId &&
		left.typeId === right.typeId
	);
}

export function applyRelationshipChange(
	relationships: Relationship[],
	change: RowChange<Relationship>,
) {
	if (change.eventType === "DELETE") {
		return relationships.filter(
			(relationship) => !isSameRelationship(relationship, change.old),
		);
	}

	const previous = change.eventType === "UPDATE" ? change.old : change.new;
	const index = relationships.findIndex((relationship) =>
		isSameRelationship(relationship, previous),
	);
	if (index === -1) return [...relationships, change.new];

	return relationships.map((relationship, relationshipIndex) =>
		relationshipIndex === index ? change.new : relationship,
	);
}
