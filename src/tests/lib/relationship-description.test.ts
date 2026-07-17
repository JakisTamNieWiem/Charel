import { describe, expect, it } from "vitest";
import {
	parseRelationshipDescription,
	RELATIONSHIP_DESCRIPTION_COLORS,
	wrapRelationshipDescriptionSelection,
} from "@/lib/relationship-description";

describe("relationship description formatting", () => {
	it("provides the fixed uppercase color palette", () => {
		expect(RELATIONSHIP_DESCRIPTION_COLORS.map((color) => color.name)).toEqual([
			"RED",
			"ORANGE",
			"AMBER",
			"YELLOW",
			"LIME",
			"GREEN",
			"EMERALD",
			"TEAL",
			"CYAN",
			"SKY",
			"BLUE",
			"INDIGO",
			"VIOLET",
			"PURPLE",
			"PINK",
			"ROSE",
		]);
	});

	it("parses uppercase and mixed-case color tags", () => {
		expect(
			parseRelationshipDescription(
				"Before [RED]danger[/RED], [blue]then\ncalm[/BlUe].",
			),
		).toEqual([
			{ text: "Before " },
			{ color: "RED", text: "danger" },
			{ text: ", " },
			{ color: "BLUE", text: "then\ncalm" },
			{ text: "." },
		]);
	});

	it("leaves unknown, mismatched, and nested tags literal", () => {
		for (const description of [
			"[BROWN]unknown[/BROWN]",
			"[RED]mismatched[/BLUE]",
			"[RED]outer [BLUE]inner[/BLUE][/RED]",
		]) {
			expect(parseRelationshipDescription(description)).toEqual([
				{ text: description },
			]);
		}
	});

	it("wraps selected text and places the caret after the closing tag", () => {
		expect(
			wrapRelationshipDescriptionSelection("one two", 4, 7, "RED"),
		).toEqual({
			selectionEnd: 18,
			selectionStart: 18,
			value: "one [RED]two[/RED]",
		});
	});

	it("inserts an empty pair and places the caret between the tags", () => {
		expect(wrapRelationshipDescriptionSelection("note", 2, 2, "BLUE")).toEqual({
			selectionEnd: 8,
			selectionStart: 8,
			value: "no[BLUE][/BLUE]te",
		});
	});
});
