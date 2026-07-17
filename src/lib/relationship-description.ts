export const RELATIONSHIP_DESCRIPTION_COLORS = [
	{ name: "RED", value: "#ef4444" },
	{ name: "ORANGE", value: "#f97316" },
	{ name: "AMBER", value: "#f59e0b" },
	{ name: "YELLOW", value: "#eab308" },
	{ name: "LIME", value: "#84cc16" },
	{ name: "GREEN", value: "#22c55e" },
	{ name: "EMERALD", value: "#10b981" },
	{ name: "TEAL", value: "#14b8a6" },
	{ name: "CYAN", value: "#06b6d4" },
	{ name: "SKY", value: "#0ea5e9" },
	{ name: "BLUE", value: "#3b82f6" },
	{ name: "INDIGO", value: "#6366f1" },
	{ name: "VIOLET", value: "#8b5cf6" },
	{ name: "PURPLE", value: "#a855f7" },
	{ name: "PINK", value: "#ec4899" },
	{ name: "ROSE", value: "#f43f5e" },
] as const;

export type RelationshipDescriptionColor =
	(typeof RELATIONSHIP_DESCRIPTION_COLORS)[number]["name"];

export type RelationshipDescriptionSegment = {
	color?: RelationshipDescriptionColor;
	text: string;
};

const colorsByName = new Map(
	RELATIONSHIP_DESCRIPTION_COLORS.map((color) => [color.name, color]),
);

function isRelationshipDescriptionColor(
	value: string,
): value is RelationshipDescriptionColor {
	return colorsByName.has(value as RelationshipDescriptionColor);
}

export function getRelationshipDescriptionColor(
	color: RelationshipDescriptionColor,
) {
	const value = colorsByName.get(color)?.value ?? "currentColor";
	return `color-mix(in oklch, ${value} 80%, var(--foreground) 20%)`;
}

function addSegment(
	segments: RelationshipDescriptionSegment[],
	text: string,
	color?: RelationshipDescriptionColor,
) {
	if (!text) return;

	const previous = segments[segments.length - 1];
	if (!color && previous && !previous.color) {
		previous.text += text;
		return;
	}

	segments.push({ color, text });
}

export function parseRelationshipDescription(
	description: string,
): RelationshipDescriptionSegment[] {
	const segments: RelationshipDescriptionSegment[] = [];
	const uppercaseDescription = description.toUpperCase();
	const openingTags = /\[([A-Z]+)\]/gi;
	const nestedTag = /\[\/?[A-Z]+\]/i;
	let cursor = 0;
	let match = openingTags.exec(description);

	while (match) {
		const color = match[1]?.toUpperCase();
		if (!color || !isRelationshipDescriptionColor(color)) {
			match = openingTags.exec(description);
			continue;
		}

		const openingStart = match.index;
		const contentStart = openingTags.lastIndex;
		const closingTag = `[/${color}]`;
		const closingStart = uppercaseDescription.indexOf(closingTag, contentStart);

		if (closingStart === -1) {
			match = openingTags.exec(description);
			continue;
		}

		const closingEnd = closingStart + closingTag.length;
		const content = description.slice(contentStart, closingStart);

		if (nestedTag.test(content)) {
			addSegment(segments, description.slice(cursor, closingEnd));
			cursor = closingEnd;
			openingTags.lastIndex = closingEnd;
			match = openingTags.exec(description);
			continue;
		}

		addSegment(segments, description.slice(cursor, openingStart));
		addSegment(segments, content, color);
		cursor = closingEnd;
		openingTags.lastIndex = closingEnd;
		match = openingTags.exec(description);
	}

	addSegment(segments, description.slice(cursor));
	return segments;
}

export function wrapRelationshipDescriptionSelection(
	description: string,
	selectionStart: number,
	selectionEnd: number,
	color: RelationshipDescriptionColor,
) {
	const openingTag = `[${color}]`;
	const closingTag = `[/${color}]`;
	const selectedText = description.slice(selectionStart, selectionEnd);
	const value = `${description.slice(0, selectionStart)}${openingTag}${selectedText}${closingTag}${description.slice(selectionEnd)}`;
	const caret = selectionStart + openingTag.length + selectedText.length;

	return {
		selectionEnd: selectedText ? caret + closingTag.length : caret,
		selectionStart: selectedText ? caret + closingTag.length : caret,
		value,
	};
}
