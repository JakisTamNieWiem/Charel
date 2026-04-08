import { create } from "zustand";

interface ChatState {
	activeChatId: string | null;
	pendingCharacterId: string | null;
	activeSpeakerId: string | null;

	setActiveChatId: (chatId: string | null) => void;
	setPendingCharacterId: (id: string | null) => void;
	setActiveSpeakerId: (characterId: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
	activeChatId: null,
	pendingCharacterId: null,
	activeSpeakerId: null,

	setActiveChatId: (chatId) => {
		set({ activeChatId: chatId, pendingCharacterId: null });
	},
	setPendingCharacterId: (id) =>
		set({ pendingCharacterId: id, activeChatId: null }),
	setActiveSpeakerId: (characterId) => set({ activeSpeakerId: characterId }),
}));
