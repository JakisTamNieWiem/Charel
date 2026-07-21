import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CharacterModal from "@/components/CharacterModal";
import type { CharacterFormData } from "@/types/types";

const hookState = vi.hoisted(() => ({
	userId: "dm-1",
	profile: {
		userId: "dm-1",
		displayName: "Current DM",
		role: "dm" as "dm" | "player",
	},
	profiles: [
		{
			userId: "dm-1",
			displayName: "Current DM",
			role: "dm" as "dm" | "player",
		},
		{
			userId: "player-1",
			displayName: "Player One",
			role: "player" as "dm" | "player",
		},
	],
	isPending: false,
	isError: false,
}));

vi.mock("@/context/AuthProvider", () => ({
	useAuth: () => ({ session: { user: { id: hookState.userId } } }),
}));

vi.mock("@/hooks/useProfile", () => ({
	useProfile: () => ({ data: hookState.profile }),
	useProfiles: () => ({
		data: hookState.profiles,
		isPending: hookState.isPending,
		isError: hookState.isError,
	}),
}));

const newCharacter: CharacterFormData = {
	id: "",
	name: "",
	description: "",
	avatar: null,
	groupId: null,
	ownerId: "",
};

function renderModal(char: CharacterFormData = newCharacter, onSave = vi.fn()) {
	render(
		<CharacterModal
			char={char}
			onSave={onSave}
			open={true}
			onOpenChange={vi.fn()}
		/>,
	);
	return onSave;
}

describe("CharacterModal owner selection", () => {
	beforeEach(() => {
		hookState.userId = "dm-1";
		hookState.profile = {
			userId: "dm-1",
			displayName: "Current DM",
			role: "dm",
		};
		hookState.profiles = [
			hookState.profile,
			{
				userId: "player-1",
				displayName: "Player One",
				role: "player",
			},
		];
		hookState.isPending = false;
		hookState.isError = false;
	});

	it("lets a DM choose another owner for a new character", async () => {
		const user = userEvent.setup();
		const onSave = renderModal();
		const ownerInput = screen.getByLabelText(
			"Character Owner",
		) as HTMLInputElement;

		expect(ownerInput.value).toBe("Current DM");
		await user.click(ownerInput);
		await user.clear(ownerInput);
		await user.type(ownerInput, "Player One");
		await user.click(await screen.findByText("Player One"));
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ ownerId: "player-1" }),
		);
	});

	it("keeps regular character creation assigned to the current user", async () => {
		hookState.userId = "player-1";
		hookState.profile = {
			userId: "player-1",
			displayName: "Player One",
			role: "player",
		};
		const user = userEvent.setup();
		const onSave = renderModal();

		expect(screen.queryByLabelText("Character Owner")).toBeNull();
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ ownerId: "player-1" }),
		);
	});

	it("does not expose ownership when editing", () => {
		renderModal({
			...newCharacter,
			id: "character-1",
			ownerId: "player-1",
		});

		expect(screen.queryByLabelText("Character Owner")).toBeNull();
	});

	it("falls back to the current DM when the owner list fails", async () => {
		hookState.profiles = [];
		hookState.isError = true;
		const user = userEvent.setup();
		const onSave = renderModal();
		const ownerInput = screen.getByLabelText("Character Owner");

		expect((ownerInput as HTMLInputElement).disabled).toBe(true);
		expect(
			screen.getByText(
				"Could not load other users. This character will belong to you.",
			),
		).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ ownerId: "dm-1" }),
		);
	});
});
