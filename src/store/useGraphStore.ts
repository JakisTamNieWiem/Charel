import { create } from "zustand";
import { persist } from "zustand/middleware";
// Import your JSON file to use as the default state!
import defaultData from "@/data/data.json";
import type { Character, Relationship, RelationshipType } from "@/types";

interface GraphState {
	// --- STATE ---
	characters: Character[];
	types: RelationshipType[];
	relationships: Relationship[];
	selectedCharId: string | null;

	// --- ACTIONS: UI ---
	setSelectedCharId: (id: string | null) => void;

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

	// --- UTILITIES ---
	importData: (importedJson: any) => void;
	resetToDefault: () => void;
}

export const useGraphStore = create<GraphState>()(
	persist(
		(set) => ({
			// Initialize with your JSON data
			characters: defaultData.characters,
			types: defaultData.relationshipTypes,
			relationships: defaultData.relationships,
			selectedCharId: null,

			// --- UI ---
			setSelectedCharId: (id) => set({ selectedCharId: id }),

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
					types: [...state.types, { ...type, id: crypto.randomUUID() }],
				})),

			updateType: (type) =>
				set((state) => ({
					types: state.types.map((t) =>
						t.id === type.id ? { ...t, ...type } : t,
					),
				})),

			deleteType: (id) =>
				set((state) => ({
					types: state.types.filter((t) => t.id !== id),
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

			// --- UTILITIES ---
			resetToDefault: () =>
				set({
					characters: defaultData.characters,
					types: defaultData.relationshipTypes,
					relationships: defaultData.relationships,
					selectedCharId: null,
				}),
			importData: (importedJson) =>
				set(() => ({
					characters: importedJson.characters || [],
					// Support both "relationshipTypes" (from raw json) or "types" (if exported from store)
					types: importedJson.relationshipTypes || importedJson.types || [],
					relationships: importedJson.relationships || [],
					selectedCharId: null, // Reset selection so we don't look for an ID that no longer exists
				})),
		}),
		{
			name: "npc-relationship-storage", // Key used in localStorage
		},
	),
);
