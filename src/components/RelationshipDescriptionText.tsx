import { Fragment } from "react";
import {
	getRelationshipDescriptionColor,
	parseRelationshipDescription,
} from "@/lib/relationship-description";

type RelationshipDescriptionTextProps = {
	text: string;
};

export default function RelationshipDescriptionText({
	text,
}: RelationshipDescriptionTextProps) {
	let offset = 0;

	return parseRelationshipDescription(text).map((segment) => {
		const key = `${offset}-${segment.color ?? "text"}`;
		offset += segment.text.length;

		return segment.color ? (
			<span
				key={key}
				style={{ color: getRelationshipDescriptionColor(segment.color) }}
			>
				{segment.text}
			</span>
		) : (
			<Fragment key={key}>{segment.text}</Fragment>
		);
	});
}
