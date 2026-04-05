import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Chat, ChatMember, Message, Profile } from "@/types/chat";

export type { Chat, ChatMember, Message, Profile };

const PAGE_SIZE = 100;

interface ChatState {
	chats: Chat[];
	chatMembers: Record<string, ChatMember[]>;
	messages: Record<string, Message[]>;
	hasMore: Record<string, boolean>;
	loading: Record<string, boolean>;
	activeChatId: string | null;
	pendingCharacterId: string | null;
	profile: Profile | null;
	activeSpeakerId: string | null;

	setChats: (chats: Chat[]) => void;
	setActiveChatId: (chatId: string | null) => void;
	setPendingCharacterId: (id: string | null) => void;
	setActiveSpeakerId: (characterId: string | null) => void;
	setProfile: (profile: Profile) => void;
	setChatMembers: (chatId: string, members: ChatMember[]) => void;
	setMessages: (chatId: string, messages: Message[]) => void;
	addMessage: (chatId: string, message: Message) => void;
	updateMessageLocal: (
		chatId: string,
		messageId: string,
		content: string,
	) => void;
	removeMessageLocal: (chatId: string, messageId: string) => void;

	fetchChats: () => Promise<void>;
	fetchLatestMessages: () => Promise<void>;
	fetchMessages: (chatId: string) => Promise<void>;
	fetchOlderMessages: (chatId: string) => Promise<void>;
	fetchChatMembers: (chatId: string) => Promise<void>;
	sendMessage: (content: string) => Promise<void>;
	editMessage: (
		messageId: string,
		chatId: string,
		content: string,
	) => Promise<void>;
	deleteMessage: (messageId: string, chatId: string) => Promise<void>;
	createChat: (
		name: string | null,
		isGroup: boolean,
		characterIds: string[],
	) => Promise<string | null>;
	deleteChat: (chatId: string) => Promise<void>;
	renameChat: (chatId: string, name: string) => Promise<void>;
	addChatMembers: (chatId: string, characterIds: string[]) => Promise<void>;
	removeChatMember: (chatId: string, characterId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
	chats: [],
	chatMembers: {},
	messages: {},
	hasMore: {},
	loading: {},
	activeChatId: null,
	pendingCharacterId: null,
	profile: null,
	activeSpeakerId: null,

	setChats: (chats) => set({ chats }),
	setActiveChatId: (chatId) =>
		set({ activeChatId: chatId, pendingCharacterId: null }),
	setPendingCharacterId: (id) =>
		set({ pendingCharacterId: id, activeChatId: null }),
	setActiveSpeakerId: (characterId) => set({ activeSpeakerId: characterId }),
	setProfile: (profile) => set({ profile }),
	setChatMembers: (chatId, members) =>
		set((state) => ({
			chatMembers: { ...state.chatMembers, [chatId]: members },
		})),
	setMessages: (chatId, messages) =>
		set((state) => ({ messages: { ...state.messages, [chatId]: messages } })),
	addMessage: (chatId, message) =>
		set((state) => {
			const existing = state.messages[chatId] || [];
			if (existing.some((m) => m.id === message.id)) return state;
			const filtered = existing.filter(
				(m) => !m._pending || m.content !== message.content,
			);
			return {
				messages: { ...state.messages, [chatId]: [...filtered, message] },
			};
		}),
	updateMessageLocal: (chatId, messageId, content) =>
		set((state) => ({
			messages: {
				...state.messages,
				[chatId]: (state.messages[chatId] || []).map((m) =>
					m.id === messageId
						? { ...m, content, edited_at: new Date().toISOString() }
						: m,
				),
			},
		})),
	removeMessageLocal: (chatId, messageId) =>
		set((state) => ({
			messages: {
				...state.messages,
				[chatId]: (state.messages[chatId] || []).filter(
					(m) => m.id !== messageId,
				),
			},
		})),

	fetchChats: async () => {
		const { data, error } = await supabase
			.from("Chats")
			.select("*")
			.order("lastMessageAt", { ascending: false, nullsFirst: false });
		if (error) {
			console.error("Failed to fetch chats:", error);
			return;
		}
		set({ chats: (data as Chat[]) || [] });
	},

	fetchLatestMessages: async () => {
		const { chats } = get();
		for (const chat of chats) {
			if (get().messages[chat.id]?.length) continue; // already loaded
			const { data } = await supabase
				.from("Messages")
				.select("*, character:Characters!characterId(name, avatar)")
				.eq("chat", chat.id)
				.order("created_at", { ascending: false })
				.limit(1);
			if (data && data.length > 0) {
				get().setMessages(chat.id, data as Message[]);
			}
		}
	},

	fetchMessages: async (chatId) => {
		set((s) => ({ loading: { ...s.loading, [chatId]: true } }));
		const { data, error } = await supabase
			.from("Messages")
			.select("*, character:Characters!characterId(name, avatar)")
			.eq("chat", chatId)
			.order("created_at", { ascending: false })
			.limit(PAGE_SIZE);
		set((s) => ({ loading: { ...s.loading, [chatId]: false } }));
		if (error) {
			console.error("Failed to fetch messages:", error);
			return;
		}
		const msgs = ((data as Message[]) || []).reverse();
		get().setMessages(chatId, msgs);
		set((s) => ({
			hasMore: { ...s.hasMore, [chatId]: (data?.length ?? 0) >= PAGE_SIZE },
		}));
	},

	fetchOlderMessages: async (chatId) => {
		const existing = get().messages[chatId] || [];
		if (existing.length === 0 || get().loading[chatId]) return;
		const oldest = existing.find((m) => !m._pending);
		if (!oldest) return;
		set((s) => ({ loading: { ...s.loading, [chatId]: true } }));
		const { data, error } = await supabase
			.from("Messages")
			.select("*, character:Characters!characterId(name, avatar)")
			.eq("chat", chatId)
			.lt("created_at", oldest.created_at)
			.order("created_at", { ascending: false })
			.limit(PAGE_SIZE);
		set((s) => ({ loading: { ...s.loading, [chatId]: false } }));
		if (error) {
			console.error("Failed to fetch older messages:", error);
			return;
		}
		const older = ((data as Message[]) || []).reverse();
		set((s) => ({
			messages: { ...s.messages, [chatId]: [...older, ...existing] },
			hasMore: { ...s.hasMore, [chatId]: (data?.length ?? 0) >= PAGE_SIZE },
		}));
	},

	fetchChatMembers: async (chatId) => {
		const { data, error } = await supabase
			.from("ChatsMembers")
			.select("*")
			.eq("chatId", chatId);
		if (error) {
			console.error("Failed to fetch chat members:", error);
			return;
		}
		get().setChatMembers(chatId, (data as ChatMember[]) || []);
	},

	sendMessage: async (content) => {
		let { activeChatId, activeSpeakerId, pendingCharacterId } = get();
		if (!activeSpeakerId) return;
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;

		if (!activeChatId && pendingCharacterId) {
			const memberIds = [activeSpeakerId, pendingCharacterId].filter(
				(id, i, arr) => arr.indexOf(id) === i,
			);
			const chatId = await get().createChat(null, false, memberIds);
			if (!chatId) return;
			activeChatId = chatId;
			set({ activeChatId: chatId, pendingCharacterId: null });
		}
		if (!activeChatId) return;

		const tempId = `pending-${Date.now()}`;
		const optimisticMsg: Message = {
			id: tempId,
			chat: activeChatId,
			content,
			characterId: activeSpeakerId,
			userId: session.user.id,
			created_at: new Date().toISOString(),
			edited_at: null,
			_pending: true,
		};
		get().addMessage(activeChatId, optimisticMsg);

		const { error } = await supabase.from("Messages").insert({
			chat: activeChatId,
			content,
			characterId: activeSpeakerId,
			userId: session.user.id,
		});
		if (error) {
			console.error("Failed to send message:", error);
			get().removeMessageLocal(activeChatId, tempId);
			return;
		}
		await get().fetchMessages(activeChatId);
		await supabase
			.from("Chats")
			.update({ lastMessageAt: new Date().toISOString() })
			.eq("id", activeChatId);
	},

	editMessage: async (messageId, chatId, content) => {
		get().updateMessageLocal(chatId, messageId, content);
		const { error } = await supabase
			.from("Messages")
			.update({ content, edited_at: new Date().toISOString() })
			.eq("id", messageId);
		if (error) {
			console.error("Failed to edit message:", error);
			get().fetchMessages(chatId);
		}
	},

	deleteMessage: async (messageId, chatId) => {
		get().removeMessageLocal(chatId, messageId);
		const { error } = await supabase
			.from("Messages")
			.delete()
			.eq("id", messageId);
		if (error) {
			console.error("Failed to delete message:", error);
			get().fetchMessages(chatId);
		}
	},

	createChat: async (name, isGroup, characterIds) => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return null;
		const { data, error } = await supabase
			.from("Chats")
			.insert({ name: name || "Chat", isGroup })
			.select()
			.single();
		if (error || !data) {
			console.error("Failed to create chat:", error);
			return null;
		}
		const chat = data as Chat;
		if (characterIds.length > 0) {
			const members = characterIds.map((characterId) => ({
				chatId: chat.id,
				characterId,
				userId: session.user.id,
			}));
			const { error: e } = await supabase.from("ChatsMembers").insert(members);
			if (e) console.error("Failed to add members:", e);
		}
		await get().fetchChats();
		return chat.id;
	},

	deleteChat: async (chatId) => {
		if (get().activeChatId === chatId) set({ activeChatId: null });
		set((s) => ({ chats: s.chats.filter((c) => c.id !== chatId) }));
		await supabase.from("ChatsMembers").delete().eq("chatId", chatId);
		await supabase.from("Messages").delete().eq("chat", chatId);
		await supabase.from("Chats").delete().eq("id", chatId);
		await get().fetchChats();
	},

	renameChat: async (chatId, name) => {
		set((s) => ({
			chats: s.chats.map((c) => (c.id === chatId ? { ...c, name } : c)),
		}));
		const { error } = await supabase
			.from("Chats")
			.update({ name })
			.eq("id", chatId);
		if (error) {
			console.error("Failed to rename chat:", error);
			await get().fetchChats();
		}
	},

	addChatMembers: async (chatId, characterIds) => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) return;
		const members = characterIds.map((characterId) => ({
			chatId,
			characterId,
			userId: session.user.id,
		}));
		const { error } = await supabase.from("ChatsMembers").insert(members);
		if (error) {
			console.error("Failed to add members:", error);
			return;
		}
		await get().fetchChatMembers(chatId);
	},

	removeChatMember: async (chatId, characterId) => {
		set((s) => ({
			chatMembers: {
				...s.chatMembers,
				[chatId]: (s.chatMembers[chatId] || []).filter(
					(m) => m.characterId !== characterId,
				),
			},
		}));
		const { error } = await supabase
			.from("ChatsMembers")
			.delete()
			.eq("chatId", chatId)
			.eq("characterId", characterId);
		if (error) {
			console.error("Failed to remove member:", error);
			await get().fetchChatMembers(chatId);
		}
	},
}));
