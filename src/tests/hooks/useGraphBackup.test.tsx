import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGraphBackup } from "@/hooks/useGraphBackup";
import { useGraphStore } from "@/store/useGraphStore";

vi.mock("@/lib/storage", () => ({
	isDesktopTauri: () => false,
	saveGraphBackup: vi.fn(),
}));

function BackupProbe() {
	useGraphBackup();
	return null;
}

describe("useGraphBackup", () => {
	it("does not subscribe to graph changes in the browser", () => {
		const subscribe = vi.spyOn(useGraphStore, "subscribe");

		render(<BackupProbe />);

		expect(subscribe).not.toHaveBeenCalled();
	});
});
