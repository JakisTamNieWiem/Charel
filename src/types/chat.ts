export interface Chat {
	id: string;
	name: string | null;
	cover: string | null;
	ownerId: string;
	isGroup: boolean | null;
	created_at: string;
	lastMessageAt: string | null;
}

export interface ChatMember {
	chatId: string;
	characterId: string;
	userId: string;
	lastReadAt: string | null;
}

export interface Contact {
	created_at: string;
	fromId: string;
	toId: string;
}

export interface Message {
	id: string;
	chat: string;
	content: string;
	characterId: string;
	userId: string;
	created_at: string;
	edited_at: string | null;
	character?: { name: string; avatar: string | null };
	_pending?: boolean;
}

export interface Profile {
	userId: string;
	displayName: string | null;
	role: "dm" | "player" | null;
}

/** Shape of a realtime INSERT/UPDATE payload.new for Messages */
export interface RealtimeMessagePayload {
	id: string;
	chat: string;
	content: string;
	characterId: string;
	userId: string;
	created_at: string;
	edited_at: string | null;
}

/** Shape of a realtime DELETE payload.old for Messages (partial) */
export interface RealtimeMessageDeletePayload {
	id: string;
	chat?: string;
}

export interface DateGroup {
	date: string;
	msgs: Message[];
}
