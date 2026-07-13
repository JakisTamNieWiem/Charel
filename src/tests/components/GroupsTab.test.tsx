import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupCard } from "@/components/Sidebar/GroupsTab";

const group = { id: "group-1", name: "Allies", color: "#112233" };

function renderGroupCard() {
	const onUpdate = vi.fn(async () => {});
	const onDelete = vi.fn(async () => {});
	render(
		<GroupCard
			group={group}
			members={[]}
			availableToAdd={[]}
			onUpdate={onUpdate}
			onDelete={onDelete}
			onAssign={vi.fn(async () => {})}
		/>,
	);
	return { onUpdate, onDelete };
}

describe("GroupCard", () => {
	it("commits a draft once when focus leaves the card", () => {
		const { onUpdate } = renderGroupCard();
		const name = screen.getByDisplayValue("Allies");

		fireEvent.change(name, { target: { value: "Friends" } });
		fireEvent.blur(name, { relatedTarget: document.body });

		expect(onUpdate).toHaveBeenCalledOnce();
		expect(onUpdate).toHaveBeenCalledWith({
			...group,
			name: "Friends",
		});
	});

	it("restores the saved value with Escape", () => {
		const { onUpdate } = renderGroupCard();
		const name = screen.getByDisplayValue("Allies");

		fireEvent.change(name, { target: { value: "Friends" } });
		fireEvent.keyDown(name, { key: "Escape" });
		expect((name as HTMLInputElement).value).toBe("Allies");
		fireEvent.blur(name, { relatedTarget: document.body });

		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("discards the draft when the group is deleted", () => {
		const { onUpdate, onDelete } = renderGroupCard();
		fireEvent.change(screen.getByDisplayValue("Allies"), {
			target: { value: "Friends" },
		});
		fireEvent.click(screen.getByTitle("Delete group"));

		expect(onDelete).toHaveBeenCalledWith(group.id);
		expect(onUpdate).not.toHaveBeenCalled();
	});
});
