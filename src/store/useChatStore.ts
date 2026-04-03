import { create } from "zustand";
import type { Database } from "@/database.types"; // Your generated types
import { supabase } from "@/lib/supabase";

// Helper types based on your schema
type Chat = Database["public"]["Tables"]["Chats"]["Row"];
type Message = Database["public"]["Tables"]["Messages"]["Row"] & {
	// We will join Character data when fetching so we can display the Avatar & Name
	character?: { name: string; avatar: string | null };
};

interface ChatState {
	// --- STATE ---
	chats: Chat[];
	messages: Record<string, Message[]>; // Dictionary: {[chatId]: Message[] }
	activeChatId: string | null;

	// THE DM MAGIC: Which character is the user currently typing as?
	activeSpeakerId: string | null;

	// --- ACTIONS ---
	setChats: (chats: Chat[]) => void;
	setActiveChatId: (chatId: string | null) => void;
	setActiveSpeakerId: (characterId: string) => void;

	// Message handling
	addMessage: (chatId: string, message: Message) => void;
	setMessages: (chatId: string, messages: Message[]) => void;

	// Thunks (Async Actions)
	sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
	chats: [],
	messages: {},
	activeChatId: null,
	activeSpeakerId: null,

	setChats: (chats) => set({ chats }),
	setActiveChatId: (chatId) => set({ activeChatId: chatId }),
	setActiveSpeakerId: (characterId) => set({ activeSpeakerId: characterId }),

	setMessages: (chatId, messages) =>
		set((state) => ({
			messages: { ...state.messages, [chatId]: messages },
		})),

	addMessage: (chatId, message) =>
		set((state) => ({
			messages: {
				...state.messages,
				// Append the new message to the existing array for this chat
				[chatId]: [...(state.messages[chatId] || []), message],
			},
		})),

	sendMessage: async (content) => {
		const { activeChatId, activeSpeakerId } = get();
		if (!activeChatId || !activeSpeakerId) return;

		// 1. Get the real User ID (the human behind the keyboard)
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		// 2. Push to Supabase
		const { error } = await supabase.from("Messages").insert({
			chat: activeChatId,
			content: content,
			characterId: activeSpeakerId, // Speaking AS this character
			userId: session.user.id, // Logged by this human
		});

		if (error) console.error("Failed to send message:", error);

		// (Optional) Update the "lastMessageAt" on the Chat table so it jumps to top of list
		await supabase
			.from("Chats")
			.update({ lastMessageAt: new Date().toISOString() })
			.eq("id", activeChatId);
	},
}));
