import { describe, expect, it } from "vitest";
import { parseGraphSnapshot } from "@/lib/storage";

const graphData = {
	characters: [],
	relationshipTypes: [],
	relationships: [],
	groups: [],
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
});
