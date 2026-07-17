import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RelationshipDescriptionText from "@/components/RelationshipDescriptionText";

describe("RelationshipDescriptionText", () => {
	it("renders formatted segments as text and safe spans", () => {
		const { container } = render(
			<p>
				<RelationshipDescriptionText
					text={'Safe [RED]<script>alert("x")</script>[/RED] text'}
				/>
			</p>,
		);

		expect(container.textContent).toBe('Safe <script>alert("x")</script> text');
		expect(container.querySelector("script")).toBeNull();
		const coloredText = container.querySelector("span");
		expect(coloredText?.textContent).toBe('<script>alert("x")</script>');
		expect(coloredText?.getAttribute("style")).toContain("#ef4444");
	});
});
