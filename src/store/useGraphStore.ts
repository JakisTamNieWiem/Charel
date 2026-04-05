import { toast } from "sonner";
import { temporal } from "zundo";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
// Import your JSON file to use as the default state!
import type {
	Character,
	Group,
	Relationship,
	RelationshipType,
} from "@/types/types";

const defaultData = {
	characters: [] as Character[],
	relationships: [] as Relationship[],
	groups: [] as Group[],
	relationshipTypes: [] as RelationshipType[],
};
type ViewMode = "character" | "network";
type NetworkMode = "group" | "global";

interface GraphState {
	// --- LOAD STATE ---
	isSyncing: boolean;
	setSyncing: (isSyncing: boolean) => void;
	// --- GRAPH STATE ---
	characters: Character[];
	relationshipTypes: RelationshipType[];
	relationships: Relationship[];
	groups: Group[];
	selectedCharId: string | null;
	viewMode: ViewMode;
	networkMode: NetworkMode;

	// --- ACTIONS: UI ---
	setSelectedCharId: (id: string | null) => void;
	setViewMode: (mode: ViewMode) => void;
	setNetworkMode: (mode: NetworkMode) => void;

	// --- ACTIONS: CHARACTERS ---
	addCharacter: (char: Omit<Character, "id">) => void;
	updateCharacter: (char: Character) => void;
	deleteCharacter: (id: string) => void;

	// --- ACTIONS: RELATIONSHIP TYPES ---
	addType: (type: Omit<RelationshipType, "id">) => void;
	updateType: (type: RelationshipType) => void;
	deleteType: (id: string) => void;

	// --- ACTIONS: RELATIONSHIPS ---
	addRelationship: (rel: Relationship) => void;
	updateRelationship: (oldRel: Relationship, newRel: Relationship) => void;
	deleteRelationship: (fromId: string, toId: string, typeId: string) => void;

	// --- ACTIONS: GROUPS ---
	addGroup: (group: Omit<Group, "id">) => void;
	updateGroup: (group: Group) => void;
	deleteGroup: (id: string) => void;
	assignCharacterToGroup: (charId: string, groupId: string | null) => void;

	// --- UTILITIES ---
	importData: (importedJson: Partial<GraphState>) => void;
	resetToDefault: () => void;
}

export const useGraphStore = create<GraphState>()(
	persist(
		temporal((set, get) => ({
			isSyncing: false,
			setSyncing: (isSyncing: boolean) => set({ isSyncing }),
			// Initialize with your JSON data
			...defaultData,
			selectedCharId: null,
			viewMode: "character" as ViewMode,
			networkMode: "group" as NetworkMode,

			// --- UI ---
			setSelectedCharId: (id) => set({ selectedCharId: id }),
			setViewMode: (mode) => set({ viewMode: mode }),
			setNetworkMode: (mode) => set({ networkMode: mode }),

			// --- CHARACTERS ---
			addCharacter: async (char) => {
				const prevCharacters = get().characters;
				const id = crypto.randomUUID();

				set((state) => ({
					characters: [...state.characters, { ...char, id }],
				}));

				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Characters")
						.insert({ ...char, id })
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ characters: prevCharacters });
						toast.error("Error adding character!");
					}
				}
			},

			updateCharacter: async (char) => {
				const prevCharacters = get().characters;
				set((state) => ({
					characters: state.characters.map((c) =>
						c.id === char.id ? char : c,
					),
				}));
				const { data } = await supabase.auth.getSession();
				console.log(char);
				if (data.session) {
					const { error } = await supabase
						.from("Characters")
						.update({
							name: char.name,
							description: char.description,
							avatar: char.avatar,
							groupId: char.groupId,
						})
						.eq("id", char.id)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ characters: prevCharacters });
						toast.error("Error updating character!");
					}
				}
			},

			deleteCharacter: async (id) => {
				const prevCharacters = get().characters;
				const prevRelationships = get().relationships;
				const prevSelectedCharId = get().selectedCharId;
				set((state) => ({
					characters: state.characters.filter((c) => c.id !== id),
					// CASCADING DELETE: If a character is deleted, remove all their relationships too!
					relationships: state.relationships.filter(
						(r) => r.fromId !== id && r.toId !== id,
					),
					selectedCharId:
						state.selectedCharId === id ? null : state.selectedCharId,
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Characters")
						.delete()
						.eq("id", id)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({
							characters: prevCharacters,
							relationships: prevRelationships,
							selectedCharId: prevSelectedCharId,
						});
						toast.error("Error deleting character!");
					}
				}
			},

			// --- RELATIONSHIP TYPES ---
			addType: async (type) => {
				const prevTypes = get().relationshipTypes;
				const id = crypto.randomUUID();
				set((state) => ({
					relationshipTypes: [...state.relationshipTypes, { ...type, id }],
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("RelationshipTypes")
						.insert({ ...type, id })
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ relationshipTypes: prevTypes });
						toast.error("Error adding relationship type!");
					}
				}
			},

			updateType: async (type) => {
				const prevTypes = get().relationshipTypes;
				set((state) => ({
					relationshipTypes: state.relationshipTypes.map((t) =>
						t.id === type.id ? type : t,
					),
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("RelationshipTypes")
						.update(type)
						.eq("id", type.id)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ relationshipTypes: prevTypes });
						toast.error("Error updating relationship type!");
					}
				}
			},

			deleteType: async (id) => {
				const prevTypes = get().relationshipTypes;
				const prevRelationships = get().relationships;
				set((state) => ({
					relationshipTypes: state.relationshipTypes.filter((t) => t.id !== id),
					// CASCADING DELETE: Remove any relationships that used this deleted type
					relationships: state.relationships.filter((r) => r.typeId !== id),
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("RelationshipTypes")
						.delete()
						.eq("id", id)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({
							relationshipTypes: prevTypes,
							relationships: prevRelationships,
						});
						toast.error("Error deleting relationship type!");
					}
				}
			},

			// --- RELATIONSHIPS ---
			addRelationship: async (newRel) => {
				const prevRelationships = get().relationships;
				set((state) => ({
					relationships: [...state.relationships, newRel],
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Relationships")
						.insert(newRel)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ relationships: prevRelationships });
						toast.error("Error adding relationship!");
					}
				}
			},

			updateRelationship: async (oldRel, newRel) => {
				const prevRelationships = get().relationships;
				set((state) => ({
					relationships: state.relationships.map((r) =>
						r.fromId === oldRel.fromId &&
						r.toId === oldRel.toId &&
						r.typeId === oldRel.typeId
							? newRel
							: r,
					),
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Relationships")
						.update(newRel)
						.eq("fromId", oldRel.fromId)
						.eq("toId", oldRel.toId)
						.eq("typeId", oldRel.typeId)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ relationships: prevRelationships });
						toast.error("Error updating relationship!");
					}
				}
			},

			deleteRelationship: async (fromId, toId, typeId) => {
				const prevRelationships = get().relationships;
				set((state) => ({
					relationships: state.relationships.filter(
						(r) =>
							!(r.fromId === fromId && r.toId === toId && r.typeId === typeId),
					),
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Relationships")
						.delete()
						.eq("fromId", fromId)
						.eq("toId", toId)
						.eq("typeId", typeId)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({
							relationships: prevRelationships,
						});
						toast.error("Error deleting relationship!");
					}
				}
			},

			// --- GROUPS ---
			addGroup: async (group) => {
				const prevGroups = get().groups;
				const id = crypto.randomUUID();
				set((state) => ({
					groups: [...state.groups, { ...group, id }],
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Groups")
						.insert({ ...group, id })
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ groups: prevGroups });
						toast.error("Error adding group!");
					}
				}
			},

			updateGroup: async (group) => {
				const prevGroups = get().groups;
				set((state) => ({
					groups: state.groups.map((g) =>
						g.id === group.id ? { ...g, ...group } : g,
					),
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Groups")
						.update(group)
						.eq("id", group.id)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ groups: prevGroups });
						toast.error("Error updating group!");
					}
				}
			},

			deleteGroup: async (id) => {
				const prevGroups = get().groups;
				const prevCharacters = get().characters;
				set((state) => ({
					groups: state.groups.filter((g) => g.id !== id),
					// Unassign characters from deleted group
					characters: state.characters.map((c) =>
						c.groupId === id ? { ...c, groupId: null } : c,
					),
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Groups")
						.delete()
						.eq("id", id)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({
							characters: prevCharacters,
							groups: prevGroups,
						});
						toast.error("Error deleting relationship type!");
					}
				}
			},

			assignCharacterToGroup: async (charId, groupId) => {
				const prevCharacters = get().characters;
				set((state) => ({
					characters: state.characters.map((c) =>
						c.id === charId ? { ...c, groupId } : c,
					),
				}));
				const { data } = await supabase.auth.getSession();
				if (data.session) {
					const { error } = await supabase
						.from("Characters")
						.update({ groupId })
						.eq("id", charId)
						.select()
						.single();
					if (error) {
						console.error("Supabase Error: ", error);
						set({ characters: prevCharacters });
						toast.error("Error assigning character to group!");
					}
				}
			},

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
