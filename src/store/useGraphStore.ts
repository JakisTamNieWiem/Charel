import { toast } from "sonner";
import { temporal } from "zundo";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
// Import your JSON file to use as the default state!
import type { Character, Group, Relationship, RelationshipType } from "@/types";

const defaultData = {
	characters: [] as Character[],
	relationships: [] as Relationship[],
	groups: [] as Group[],
	relationshipTypes: [] as RelationshipType[],
};
type ViewMode = "character" | "network";

interface GraphState {
	// --- STATE ---
	characters: Character[];
	relationshipTypes: RelationshipType[];
	relationships: Relationship[];
	groups: Group[];
	selectedCharId: string | null;
	viewMode: ViewMode;

	// --- ACTIONS: UI ---
	setSelectedCharId: (id: string | null) => void;
	setViewMode: (mode: ViewMode) => void;

	// --- ACTIONS: CHARACTERS ---
	addCharacter: (char: Omit<Character, "id">) => void;
	updateCharacter: (char: Partial<Character>) => void;
	deleteCharacter: (id: string) => void;

	// --- ACTIONS: RELATIONSHIP TYPES ---
	addType: (type: Omit<RelationshipType, "id">) => void;
	updateType: (type: Partial<RelationshipType>) => void;
	deleteType: (id: string) => void;

	// --- ACTIONS: RELATIONSHIPS ---
	addRelationship: (rel: Relationship) => void;
	updateRelationship: (oldRel: Relationship, newRel: Relationship) => void;
	deleteRelationship: (fromId: string, toId: string, typeId: string) => void;

	// --- ACTIONS: GROUPS ---
	addGroup: (group: Omit<Group, "id">) => void;
	updateGroup: (group: Partial<Group>) => void;
	deleteGroup: (id: string) => void;
	assignCharacterToGroup: (charId: string, groupId: string | null) => void;

	// --- UTILITIES ---
	importData: (importedJson: Partial<GraphState>) => void;
	resetToDefault: () => void;
}

export const useGraphStore = create<GraphState>()(
	persist(
		temporal((set, get) => ({
			// Initialize with your JSON data
			...defaultData,
			selectedCharId: null,
			viewMode: "character" as ViewMode,

			// --- UI ---
			setSelectedCharId: (id) => set({ selectedCharId: id }),
			setViewMode: (mode) => set({ viewMode: mode }),

			// --- CHARACTERS ---
			addCharacter: async (char) => {
				const prevCharacters = get().characters;
				const id = crypto.randomUUID();

				set((state) => ({
					characters: [...state.characters, { ...char, id }],
				}));
				console.log("UUID", id);
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Characters")
						.insert({ ...char, id });
					if (error) {
						console.error("Supabase Error: ", error);
						set({ characters: prevCharacters });
						toast.error("Error adding character!");
					}
				}
			},

			updateCharacter: (char) =>
				set((state) => ({
					characters: state.characters.map((c) =>
						c.id === char.id ? { ...c, ...char } : c,
					),
				})),

			deleteCharacter: (id) =>
				set((state) => ({
					characters: state.characters.filter((c) => c.id !== id),
					// CASCADING DELETE: If a character is deleted, remove all their relationships too!
					relationships: state.relationships.filter(
						(r) => r.fromId !== id && r.toId !== id,
					),
					selectedCharId:
						state.selectedCharId === id ? null : state.selectedCharId,
				})),

			// --- RELATIONSHIP TYPES ---
			addType: (type) =>
				set((state) => ({
					relationshipTypes: [
						...state.relationshipTypes,
						{ ...type, id: crypto.randomUUID() },
					],
				})),

			updateType: (type) =>
				set((state) => ({
					relationshipTypes: state.relationshipTypes.map((t) =>
						t.id === type.id ? { ...t, ...type } : t,
					),
				})),

			deleteType: (id) =>
				set((state) => ({
					relationshipTypes: state.relationshipTypes.filter((t) => t.id !== id),
					// CASCADING DELETE: Remove any relationships that used this deleted type
					relationships: state.relationships.filter((r) => r.typeId !== id),
				})),

			// --- RELATIONSHIPS ---
			addRelationship: (newRel) =>
				set((state) => ({
					relationships: [...state.relationships, newRel],
				})),

			updateRelationship: (oldRel, newRel) =>
				set((state) => ({
					relationships: state.relationships.map((r) =>
						r.fromId === oldRel.fromId &&
						r.toId === oldRel.toId &&
						r.typeId === oldRel.typeId
							? newRel
							: r,
					),
				})),

			deleteRelationship: (fromId, toId, typeId) =>
				set((state) => ({
					relationships: state.relationships.filter(
						(r) =>
							!(r.fromId === fromId && r.toId === toId && r.typeId === typeId),
					),
				})),

			// --- GROUPS ---
			addGroup: (group) =>
				set((state) => ({
					groups: [...state.groups, { ...group, id: crypto.randomUUID() }],
				})),

			updateGroup: (group) =>
				set((state) => ({
					groups: state.groups.map((g) =>
						g.id === group.id ? { ...g, ...group } : g,
					),
				})),

			deleteGroup: (id) =>
				set((state) => ({
					groups: state.groups.filter((g) => g.id !== id),
					// Unassign characters from deleted group
					characters: state.characters.map((c) =>
						c.groupId === id ? { ...c, groupId: null } : c,
					),
				})),

			assignCharacterToGroup: (charId, groupId) =>
				set((state) => ({
					characters: state.characters.map((c) =>
						c.id === charId ? { ...c, groupId } : c,
					),
				})),

			// --- UTILITIES ---
			resetToDefault: () =>
				set({
					characters: defaultData.characters,
					relationshipTypes: defaultData.relationshipTypes,
					relationships: defaultData.relationships,
					groups: defaultData.groups,
					selectedCharId: null,
				}),
			importData: (importedJson: Partial<GraphState>) =>
				set((state) => ({
					// Use ?? (nullish coalescing) or || to fall back to the CURRENT state, not an empty array
					characters: importedJson.characters ?? state.characters,
					relationshipTypes:
						importedJson.relationshipTypes ?? state.relationshipTypes,
					relationships: importedJson.relationships ?? state.relationships,
					groups: importedJson.groups ?? state.groups,

					// Preserve the currently viewed character unless the import explicitly asks to reset it!
					selectedCharId:
						importedJson.selectedCharId !== undefined
							? importedJson.selectedCharId
							: state.selectedCharId,
				})),
		})),
		{
			name: "npc-relationship-storage", // Key used in localStorage
		},
	),
);
