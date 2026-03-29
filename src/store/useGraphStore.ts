import { temporal } from "zundo";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { JsonData } from "@/lib/storage";
// Import your JSON file to use as the default state!
import type { Character, Group, Relationship, RelationshipType } from "@/types";

const defaultData = {
	characters: [] as Character[],
	relationships: [] as Relationship[],
	groups: [] as Group[],
	relationshipTypes: [
		{ id: "friend", label: "Positive", color: "#1a9548", description: "", value: 0.7 },
		{
			id: "negative",
			label: "Negative",
			color: "#6a0000",
			description: "",
			value: -0.7,
		},
		{ id: "neutral", label: "Neutral", color: "#808080", description: "", value: 0 },
		// ... add your other default Polish relationship types here
	] as RelationshipType[],
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
	assignCharacterToGroup: (charId: string, groupId: string | undefined) => void;

	// --- UTILITIES ---
	importData: (importedJson: JsonData) => void;
	resetToDefault: () => void;
}

export const useGraphStore = create<GraphState>()(
	persist(
		temporal((set) => ({
			// Initialize with your JSON data
			...defaultData,
			selectedCharId: null,
			viewMode: "character" as ViewMode,

			// --- UI ---
			setSelectedCharId: (id) => set({ selectedCharId: id }),
			setViewMode: (mode) => set({ viewMode: mode }),

			// --- CHARACTERS ---
			addCharacter: (char) =>
				set((state) => ({
					characters: [
						...state.characters,
						{ ...char, id: crypto.randomUUID() },
					],
				})),

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
					groups: [
						...state.groups,
						{ ...group, id: crypto.randomUUID() },
					],
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
						c.groupId === id ? { ...c, groupId: undefined } : c,
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
			importData: (importedJson) =>
				set(() => ({
					characters: importedJson.characters || [],
					relationshipTypes: importedJson.relationshipTypes || [],
					relationships: importedJson.relationships || [],
					groups: importedJson.groups || [],
					selectedCharId: null,
				})),
		})),
		{
			name: "npc-relationship-storage", // Key used in localStorage
		},
	),
);
