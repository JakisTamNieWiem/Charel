export const RELATIONSHIP_DESCRIPTION_COLORS = [
	{ name: "RED", value: "#ff1744" },
	{ name: "GREEN", value: "#00c853" },
	{ name: "BLUE", value: "#2962ff" },
	{ name: "YELLOW", value: "#ffd600" },
	{ name: "PURPLE", value: "#aa00ff" },
	{ name: "CYAN", value: "#00b8d4" },
	{ name: "ORANGE", value: "#ff6d00" },
	{ name: "LIME", value: "#aeea00" },
	{ name: "ROSE", value: "#ff4081" },
	{ name: "EMERALD", value: "#00e676" },
	{ name: "INDIGO", value: "#304ffe" },
	{ name: "AMBER", value: "#ffab00" },
	{ name: "PINK", value: "#f50057" },
	{ name: "TEAL", value: "#00bfa5" },
	{ name: "VIOLET", value: "#7c4dff" },
	{ name: "SKY", value: "#0091ea" },
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
	return `color-mix(in oklch, ${value} 94%, var(--foreground) 6%)`;
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
