import { toast } from "sonner";
import { temporal } from "zundo";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NetworkCurveStyle } from "@/lib/network-graph";
import { isSameRelationship } from "@/lib/realtime-graph";
import { supabase } from "@/lib/supabase";
import type {
	CharacterFormData,
	GraphData,
	GraphSnapshot,
	GraphSyncStatus,
	Group,
	Relationship,
	RelationshipInput,
	RelationshipType,
} from "@/types/types";

const defaultData: GraphData = {
	characters: [],
	relationships: [],
	groups: [],
	relationshipTypes: [],
};

type NetworkMode = "group" | "groups" | "global";
type ImportData = Partial<GraphData> & {
	selectedCharId?: string | null;
	networkCurveStyle?: NetworkCurveStyle;
};

type MutationOptions<TSnapshot> = {
	capture: () => TSnapshot;
	update: (userId: string) => void;
	remote: (userId: string) => PromiseLike<{ error: unknown }>;
	rollback: (snapshot: TSnapshot) => void;
	errorMessage: string;
};

async function runOptimisticMutation<TSnapshot>({
	capture,
	update,
	remote,
	rollback,
	errorMessage,
}: MutationOptions<TSnapshot>) {
	const snapshot = capture();
	const { data } = await supabase.auth.getSession();
	const userId = data.session?.user.id ?? "";

	update(userId);
	if (!userId) return;

	try {
		const { error } = await remote(userId);
		if (!error) return;

		console.error("Supabase mutation failed:", error);
		rollback(snapshot);
		toast.error(errorMessage);
	} catch (error) {
		console.error("Supabase mutation failed:", error);
		rollback(snapshot);
		toast.error(errorMessage);
	}
}

export interface GraphState extends GraphData {
	syncStatus: GraphSyncStatus;
	syncError: string | null;
	isInitialized: boolean;
	selectedCharId: string | null;
	networkMode: NetworkMode;
	networkCurveStyle: NetworkCurveStyle;
	showRelationshipTypeLegend: boolean;
	setSyncState: (
		status: GraphSyncStatus,
		options?: { error?: string | null; initialized?: boolean },
	) => void;
	setSelectedCharId: (id: string | null) => void;
	setNetworkMode: (mode: NetworkMode) => void;
	setNetworkCurveStyle: (style: NetworkCurveStyle) => void;
	setShowRelationshipTypeLegend: (show: boolean) => void;
	addCharacter: (character: Omit<CharacterFormData, "id">) => Promise<void>;
	updateCharacter: (
		character: Omit<CharacterFormData, "ownerId">,
	) => Promise<void>;
	deleteCharacter: (id: string) => Promise<void>;
	addType: (type: Omit<RelationshipType, "id">) => Promise<void>;
	updateType: (type: RelationshipType) => Promise<void>;
	deleteType: (id: string) => Promise<void>;
	addRelationship: (relationship: RelationshipInput) => Promise<void>;
	updateRelationship: (
		oldRelationship: Relationship,
		newRelationship: Relationship,
	) => Promise<void>;
	deleteRelationship: (relationship: Relationship) => Promise<void>;
	addGroup: (group: Omit<Group, "id">) => Promise<void>;
	updateGroup: (group: Group) => Promise<void>;
	deleteGroup: (id: string) => Promise<void>;
	assignCharacterToGroup: (
		characterId: string,
		groupId: string | null,
	) => Promise<void>;
	importData: (data: ImportData) => void;
	resetToDefault: () => void;
}

export function createGraphSnapshot(state: GraphData): GraphSnapshot {
	return {
		version: "2",
		characters: state.characters,
		relationshipTypes: state.relationshipTypes,
		relationships: state.relationships,
		groups: state.groups,
	};
}

export const useGraphStore = create<GraphState>()(
	persist(
		temporal(
			(set, get) => ({
				...defaultData,
				syncStatus: "initializing",
				syncError: null,
				isInitialized: false,
				selectedCharId: null,
				networkMode: "group",
				networkCurveStyle: "quadratic",
				showRelationshipTypeLegend: true,

				setSyncState: (status, options) =>
					set({
						syncStatus: status,
						syncError: options?.error ?? null,
						isInitialized: options?.initialized ?? get().isInitialized,
					}),
				setSelectedCharId: (selectedCharId) => set({ selectedCharId }),
				setNetworkMode: (networkMode) => set({ networkMode }),
				setNetworkCurveStyle: (networkCurveStyle) => set({ networkCurveStyle }),
				setShowRelationshipTypeLegend: (showRelationshipTypeLegend) =>
					set({ showRelationshipTypeLegend }),

				addCharacter: (character) =>
					(() => {
						const id = crypto.randomUUID();
						return runOptimisticMutation({
							capture: () => get().characters,
							update: (authenticatedUserId) => {
								const ownerId = character.ownerId || authenticatedUserId;
								set((state) => ({
									characters: [
										...state.characters,
										{ ...character, id, ownerId },
									],
								}));
							},
							remote: (authenticatedUserId) => {
								const ownerId = character.ownerId || authenticatedUserId;
								return supabase
									.from("Characters")
									.insert({ ...character, id, ownerId })
									.select()
									.single();
							},
							rollback: (characters) => set({ characters }),
							errorMessage: "Error adding character!",
						});
					})(),

				updateCharacter: (character) =>
					runOptimisticMutation({
						capture: () => get().characters,
						update: () =>
							set((state) => ({
								characters: state.characters.map((current) =>
									current.id === character.id
										? { ...current, ...character }
										: current,
								),
							})),
						remote: () =>
							supabase
								.from("Characters")
								.update({
									name: character.name,
									description: character.description,
									avatar: character.avatar,
									groupId: character.groupId,
								})
								.eq("id", character.id)
								.select()
								.single(),
						rollback: (characters) => set({ characters }),
						errorMessage: "Error updating character!",
					}),

				deleteCharacter: (id) =>
					runOptimisticMutation({
						capture: () => ({
							characters: get().characters,
							relationships: get().relationships,
							selectedCharId: get().selectedCharId,
						}),
						update: () =>
							set((state) => ({
								characters: state.characters.filter(
									(character) => character.id !== id,
								),
								relationships: state.relationships.filter(
									(relationship) =>
										relationship.fromId !== id && relationship.toId !== id,
								),
								selectedCharId:
									state.selectedCharId === id ? null : state.selectedCharId,
							})),
						remote: () =>
							supabase
								.from("Characters")
								.delete()
								.eq("id", id)
								.select()
								.single(),
						rollback: (snapshot) => set(snapshot),
						errorMessage: "Error deleting character!",
					}),

				addType: (type) => {
					const id = crypto.randomUUID();
					return runOptimisticMutation({
						capture: () => get().relationshipTypes,
						update: () =>
							set((state) => ({
								relationshipTypes: [
									...state.relationshipTypes,
									{ ...type, id },
								],
							})),
						remote: () =>
							supabase
								.from("RelationshipTypes")
								.insert({ ...type, id })
								.select()
								.single(),
						rollback: (relationshipTypes) => set({ relationshipTypes }),
						errorMessage: "Error adding relationship type!",
					});
				},

				updateType: (type) =>
					runOptimisticMutation({
						capture: () => get().relationshipTypes,
						update: () =>
							set((state) => ({
								relationshipTypes: state.relationshipTypes.map((current) =>
									current.id === type.id ? type : current,
								),
							})),
						remote: () =>
							supabase
								.from("RelationshipTypes")
								.update(type)
								.eq("id", type.id)
								.select()
								.single(),
						rollback: (relationshipTypes) => set({ relationshipTypes }),
						errorMessage: "Error updating relationship type!",
					}),

				deleteType: (id) =>
					runOptimisticMutation({
						capture: () => ({
							relationshipTypes: get().relationshipTypes,
							relationships: get().relationships,
						}),
						update: () =>
							set((state) => ({
								relationshipTypes: state.relationshipTypes.filter(
									(type) => type.id !== id,
								),
								relationships: state.relationships.filter(
									(relationship) => relationship.typeId !== id,
								),
							})),
						remote: () =>
							supabase
								.from("RelationshipTypes")
								.delete()
								.eq("id", id)
								.select()
								.single(),
						rollback: (snapshot) => set(snapshot),
						errorMessage: "Error deleting relationship type!",
					}),

				addRelationship: (relationship) => {
					const id = crypto.randomUUID();
					const now = new Date().toISOString();
					const newRelationship = {
						...relationship,
						id,
						created_at: now,
						updated_at: now,
					};

					return runOptimisticMutation({
						capture: () => get().relationships,
						update: () =>
							set((state) => ({
								relationships: [...state.relationships, newRelationship],
							})),
						remote: () =>
							supabase
								.from("Relationships")
								.insert({ ...relationship, id })
								.select()
								.single(),
						rollback: (relationships) => set({ relationships }),
						errorMessage: "Error adding relationship!",
					});
				},

				updateRelationship: (oldRelationship, newRelationship) => {
					const updatedRelationship = {
						...oldRelationship,
						...newRelationship,
						updated_at: new Date().toISOString(),
					};

					return runOptimisticMutation({
						capture: () => get().relationships,
						update: () =>
							set((state) => ({
								relationships: state.relationships.map((current) =>
									isSameRelationship(current, oldRelationship)
										? updatedRelationship
										: current,
								),
							})),
						remote: () => {
							const query = supabase.from("Relationships").update({
								fromId: newRelationship.fromId,
								toId: newRelationship.toId,
								typeId: newRelationship.typeId,
								description: newRelationship.description,
								value: newRelationship.value,
							});

							const filteredQuery = oldRelationship.id
								? query.eq("id", oldRelationship.id)
								: query
										.eq("fromId", oldRelationship.fromId)
										.eq("toId", oldRelationship.toId)
										.eq("typeId", oldRelationship.typeId);

							return filteredQuery.select().single();
						},
						rollback: (relationships) => set({ relationships }),
						errorMessage: "Error updating relationship!",
					});
				},

				deleteRelationship: (relationshipToDelete) =>
					runOptimisticMutation({
						capture: () => get().relationships,
						update: () =>
							set((state) => ({
								relationships: state.relationships.filter(
									(relationship) =>
										!isSameRelationship(relationship, relationshipToDelete),
								),
							})),
						remote: () => {
							const query = supabase.from("Relationships").delete();
							const filteredQuery = relationshipToDelete.id
								? query.eq("id", relationshipToDelete.id)
								: query
										.eq("fromId", relationshipToDelete.fromId)
										.eq("toId", relationshipToDelete.toId)
										.eq("typeId", relationshipToDelete.typeId);

							return filteredQuery.select().single();
						},
						rollback: (relationships) => set({ relationships }),
						errorMessage: "Error deleting relationship!",
					}),

				addGroup: (group) => {
					const id = crypto.randomUUID();
					return runOptimisticMutation({
						capture: () => get().groups,
						update: () =>
							set((state) => ({
								groups: [...state.groups, { ...group, id }],
							})),
						remote: () =>
							supabase
								.from("Groups")
								.insert({ ...group, id })
								.select()
								.single(),
						rollback: (groups) => set({ groups }),
						errorMessage: "Error adding group!",
					});
				},

				updateGroup: (group) =>
					runOptimisticMutation({
						capture: () => get().groups,
						update: () =>
							set((state) => ({
								groups: state.groups.map((current) =>
									current.id === group.id ? group : current,
								),
							})),
						remote: () =>
							supabase
								.from("Groups")
								.update(group)
								.eq("id", group.id)
								.select()
								.single(),
						rollback: (groups) => set({ groups }),
						errorMessage: "Error updating group!",
					}),

				deleteGroup: (id) =>
					runOptimisticMutation({
						capture: () => ({
							groups: get().groups,
							characters: get().characters,
						}),
						update: () =>
							set((state) => ({
								groups: state.groups.filter((group) => group.id !== id),
								characters: state.characters.map((character) =>
									character.groupId === id
										? { ...character, groupId: null }
										: character,
								),
							})),
						remote: () =>
							supabase.from("Groups").delete().eq("id", id).select().single(),
						rollback: (snapshot) => set(snapshot),
						errorMessage: "Error deleting group!",
					}),

				assignCharacterToGroup: (characterId, groupId) =>
					runOptimisticMutation({
						capture: () => get().characters,
						update: () =>
							set((state) => ({
								characters: state.characters.map((character) =>
									character.id === characterId
										? { ...character, groupId }
										: character,
								),
							})),
						remote: () =>
							supabase
								.from("Characters")
								.update({ groupId })
								.eq("id", characterId)
								.select()
								.single(),
						rollback: (characters) => set({ characters }),
						errorMessage: "Error assigning character to group!",
					}),

				resetToDefault: () =>
					set({
						...defaultData,
						selectedCharId: null,
						networkCurveStyle: "quadratic",
					}),
				importData: (data) =>
					set((state) => ({
						characters: data.characters ?? state.characters,
						relationshipTypes:
							data.relationshipTypes ?? state.relationshipTypes,
						relationships: data.relationships ?? state.relationships,
						groups: data.groups ?? state.groups,
						selectedCharId:
							data.selectedCharId !== undefined
								? data.selectedCharId
								: state.selectedCharId,
						networkCurveStyle:
							data.networkCurveStyle ?? state.networkCurveStyle,
					})),
			}),
			{
				limit: 100,
				partialize: (state) => ({
					characters: state.characters,
					relationshipTypes: state.relationshipTypes,
					relationships: state.relationships,
					groups: state.groups,
				}),
				equality: (left, right) =>
					left.characters === right.characters &&
					left.relationshipTypes === right.relationshipTypes &&
					left.relationships === right.relationships &&
					left.groups === right.groups,
			},
		),
		{
			name: "npc-relationship-storage",
			partialize: (state) => ({
				characters: state.characters,
				relationshipTypes: state.relationshipTypes,
				relationships: state.relationships,
				groups: state.groups,
				selectedCharId: state.selectedCharId,
				networkMode: state.networkMode,
				networkCurveStyle: state.networkCurveStyle,
				showRelationshipTypeLegend: state.showRelationshipTypeLegend,
			}),
		},
	),
);
