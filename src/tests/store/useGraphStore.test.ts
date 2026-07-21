import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGraphStore } from "@/store/useGraphStore";

const supabaseMocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	deleteSingle: vi.fn(),
	insert: vi.fn(),
	insertSingle: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/supabase", () => ({
	supabase: {
		auth: { getSession: supabaseMocks.getSession },
		from: vi.fn(() => ({
			insert: (value: unknown) => {
				supabaseMocks.insert(value);
				return {
					select: () => ({ single: supabaseMocks.insertSingle }),
				};
			},
			delete: () => ({
				eq: () => ({
					select: () => ({ single: supabaseMocks.deleteSingle }),
				}),
			}),
		})),
	},
}));

const character = {
	id: "character-1",
	name: "Ada",
	description: "",
	avatar: null,
	groupId: "group-1",
	ownerId: "owner-1",
};
const relationship = {
	fromId: "character-1",
	toId: "character-2",
	typeId: "type-1",
	description: "",
	value: null,
};
const group = { id: "group-1", name: "Allies", color: "#fff" };

describe("graph store mutations", () => {
	beforeEach(() => {
		supabaseMocks.getSession.mockReset();
		supabaseMocks.deleteSingle.mockReset();
		supabaseMocks.insert.mockReset();
		supabaseMocks.insertSingle.mockReset();
		useGraphStore.setState({
			characters: [character],
			relationships: [relationship],
			relationshipTypes: [],
			groups: [group],
			selectedCharId: character.id,
		});
		useGraphStore.temporal.getState().clear();
	});

	it("creates a character for the selected owner", async () => {
		supabaseMocks.getSession.mockResolvedValue({
			data: { session: { user: { id: "dm-1" } } },
		});
		supabaseMocks.insertSingle.mockResolvedValue({ error: null });

		await useGraphStore.getState().addCharacter({
			name: "New character",
			description: "",
			avatar: null,
			groupId: null,
			ownerId: "player-1",
		});

		expect(useGraphStore.getState().characters).toContainEqual(
			expect.objectContaining({
				name: "New character",
				ownerId: "player-1",
			}),
		);
		expect(supabaseMocks.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "New character",
				ownerId: "player-1",
			}),
		);
	});

	it("applies offline delete cascades without a remote mutation", async () => {
		supabaseMocks.getSession.mockResolvedValue({ data: { session: null } });

		await useGraphStore.getState().deleteCharacter(character.id);

		expect(useGraphStore.getState().characters).toEqual([]);
		expect(useGraphStore.getState().relationships).toEqual([]);
		expect(useGraphStore.getState().selectedCharId).toBeNull();
		expect(supabaseMocks.deleteSingle).not.toHaveBeenCalled();
	});

	it("rolls back a failed remote group deletion", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		supabaseMocks.getSession.mockResolvedValue({
			data: { session: { user: { id: "owner-1" } } },
		});
		supabaseMocks.deleteSingle.mockResolvedValue({
			error: new Error("failed"),
		});

		await useGraphStore.getState().deleteGroup(group.id);

		expect(useGraphStore.getState().groups).toEqual([group]);
		expect(useGraphStore.getState().characters).toEqual([character]);
	});
});
