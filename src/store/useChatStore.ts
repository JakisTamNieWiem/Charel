import { create } from "zustand";
import type { Message } from "@/types/chat";

interface ChatState {
	activeChatId: string | null;
	pendingCharacterId: string | null;
	activeSpeakerId: string | null;
	pendingMessages: Message[];

	setActiveChatId: (chatId: string | null) => void;
	setPendingCharacterId: (id: string | null) => void;
	setActiveSpeakerId: (characterId: string | null) => void;
	addPendingMessage: (message: Message) => void;
	removePendingMessage: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
	activeChatId: null,
	pendingCharacterId: null,
	activeSpeakerId: null,
	pendingMessages: [],

	setActiveChatId: (chatId) => {
		set({ activeChatId: chatId, pendingCharacterId: null });
	},
	setPendingCharacterId: (id) =>
		set({ pendingCharacterId: id, activeChatId: null }),
	setActiveSpeakerId: (characterId) => set({ activeSpeakerId: characterId }),
	addPendingMessage: (message) =>
		set((state) => ({
			pendingMessages: state.pendingMessages.some((m) => m.id === message.id)
				? state.pendingMessages
				: [...state.pendingMessages, message],
		})),
	removePendingMessage: (id) =>
		set((state) => ({
			pendingMessages: state.pendingMessages.filter((m) => m.id !== id),
		})),
}));
