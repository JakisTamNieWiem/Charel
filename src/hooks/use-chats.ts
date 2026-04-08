import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Chat, ChatMember } from "@/types/chat";

export interface ChatWithMembers extends Chat {
	members: ChatMember[];
}

export function useChats() {
	return useQuery<ChatWithMembers[]>({
		queryKey: ["chats"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("Chats")
				.select("*, members:ChatsMembers(*)")
				.order("lastMessageAt", { ascending: false, nullsFirst: false });

			if (error) throw error;
			return data as ChatWithMembers[];
		},
	});
}

export function useCreateChat() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			name,
			isGroup,
			characterIds,
		}: {
			name: string | null;
			isGroup: boolean;
			characterIds: string[];
		}) => {
			const { data: sessionData } = await supabase.auth.getSession();
			if (!sessionData.session) throw new Error("No session");

			const { data: chatData, error: chatError } = await supabase
				.from("Chats")
				.insert({
					name: name || "Chat",
					isGroup,
					ownerId: sessionData.session.user.id,
				})
				.select()
				.single();

			if (chatError || !chatData)
				throw chatError || new Error("Failed to create chat");

			if (characterIds.length > 0) {
				const members = characterIds.map((characterId) => ({
					chatId: chatData.id,
					characterId,
					userId: sessionData.session.user.id,
				}));
				const { error: memberError } = await supabase
					.from("ChatsMembers")
					.insert(members);
				if (memberError) throw memberError;
			}

			return chatData.id;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
		},
	});
}

export function useDeleteChat() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (chatId: string) => {
			// Cascading deletes should be handled by Supabase, but we can be explicit if needed.
			// The old useChatStore.deleteChat was explicit.
			await supabase.from("ChatsMembers").delete().eq("chatId", chatId);
			await supabase.from("Messages").delete().eq("chat", chatId);
			const { error } = await supabase.from("Chats").delete().eq("id", chatId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
		},
	});
}

export function useRenameChat() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ chatId, name }: { chatId: string; name: string }) => {
			const { error } = await supabase
				.from("Chats")
				.update({ name })
				.eq("id", chatId);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
		},
	});
}

export function useChatMembers(chatId: string) {
	return useQuery<ChatMember[]>({
		queryKey: ["chatMembers", chatId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("ChatsMembers")
				.select("*")
				.eq("chatId", chatId);
			if (error) throw error;
			return data as ChatMember[];
		},
		enabled: !!chatId,
	});
}

export function useAddChatMembers() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			chatId,
			characterIds,
		}: {
			chatId: string;
			characterIds: string[];
		}) => {
			const { data: sessionData } = await supabase.auth.getSession();
			if (!sessionData.session) throw new Error("No session");

			const members = characterIds.map((characterId) => ({
				chatId,
				characterId,
				userId: sessionData.session.user.id,
			}));
			const { error } = await supabase.from("ChatsMembers").insert(members);
			if (error) throw error;
		},
		onSuccess: (_, { chatId }) => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
			queryClient.invalidateQueries({ queryKey: ["chatMembers", chatId] });
		},
	});
}

export function useRemoveChatMember() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			chatId,
			characterId,
		}: {
			chatId: string;
			characterId: string;
		}) => {
			const { error } = await supabase
				.from("ChatsMembers")
				.delete()
				.eq("chatId", chatId)
				.eq("characterId", characterId);
			if (error) throw error;
		},
		onSuccess: (_, { chatId }) => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
			queryClient.invalidateQueries({ queryKey: ["chatMembers", chatId] });
		},
	});
}

export function useMarkAsRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			chatId,
			characterId,
		}: {
			chatId: string;
			characterId: string;
		}) => {
			const now = new Date().toISOString();
			const { error } = await supabase
				.from("ChatsMembers")
				.update({ lastReadAt: now })
				.eq("chatId", chatId)
				.eq("characterId", characterId);
			if (error) throw error;
		},
		onSuccess: (_, { chatId }) => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
			queryClient.invalidateQueries({ queryKey: ["chatMembers", chatId] });
		},
	});
}
