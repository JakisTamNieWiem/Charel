export interface Character {
	id: string;
	name: string;
	description: string;
	avatar?: string;
}

export interface RelationshipType {
	id: string;
	label: string;
	color: string;
	description: string;
}

export interface Relationship {
	fromId: string;
	toId: string;
	typeId: string;
	description: string;
}

export interface AppData {
	characters: Character[];
	relationshipTypes: RelationshipType[];
	relationships: Relationship[];
}
