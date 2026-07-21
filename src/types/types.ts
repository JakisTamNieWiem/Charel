import type { Tables } from "@/types/database.types";

type WithOptionalFields<T, K extends keyof T> = Omit<T, K> &
	Partial<Pick<T, K>>;

export type Character = WithOptionalFields<
	Tables<"Characters">,
	"created_at" | "phoneNumber" | "status" | "updated_at"
>;

export type CharacterFormData = Pick<
	Character,
	"id" | "name" | "description" | "avatar" | "groupId" | "ownerId"
>;

export type Group = WithOptionalFields<Tables<"Groups">, "updated_at">;

export type RelationshipType = WithOptionalFields<
	Tables<"RelationshipTypes">,
	"updated_at"
>;

export type Relationship = WithOptionalFields<
	Tables<"Relationships">,
	"created_at" | "id" | "updated_at"
>;

export type RelationshipInput = Omit<
	Relationship,
	"created_at" | "id" | "updated_at"
>;

export interface GraphData {
	characters: Character[];
	relationshipTypes: RelationshipType[];
	relationships: Relationship[];
	groups: Group[];
}

export interface GraphSnapshot extends GraphData {
	version: "2";
}

export type GraphSyncStatus =
	| "initializing"
	| "offline"
	| "syncing"
	| "connected"
	| "error";

export type AppData = GraphData;
