export interface Character {
	id: string;
	name: string;
	description: string;
	avatar?: string;
	groupId?: string;
}

export interface Group {
	id: string;
	name: string;
	color: string;
}

export interface RelationshipType {
	id: string;
	label: string;
	color: string;
	description: string;
	value: number; // -1 (hostile) to 1 (close/positive)
}

export interface Relationship {
	fromId: string;
	toId: string;
	typeId: string;
	description: string;
	value?: number; // optional override of the type's default value (-1 to 1)
}

export interface AppData {
	characters: Character[];
	relationshipTypes: RelationshipType[];
	relationships: Relationship[];
	groups: Group[];
}
