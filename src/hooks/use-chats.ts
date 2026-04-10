import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Chat, ChatMember, Contact } from "@/types/chat";
import { withNamedMutation } from "./mutation-utils";

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

export function useContacts(fromId: string) {
	return useQuery<Contact[]>({
		queryKey: ["contacts", fromId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("Contacts")
				.select("*")
				.eq("fromId", fromId);

			if (error) throw error;
			return data as Contact[];
		},
		enabled: !!fromId,
	});
}

export function useCreateChat() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
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

	return withNamedMutation(mutation, "createChat", mutation.mutateAsync);
}

export function useAddContacts() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
			const { error } = await supabase
				.from("Contacts")
				.insert({ fromId, toId });
			if (error) throw error;
		},
		onSuccess: (_, { fromId }) => {
			queryClient.invalidateQueries({ queryKey: ["contacts", fromId] });
		},
	});

	return withNamedMutation(mutation, "addContacts", mutation.mutateAsync);
}

export function useDeleteChat() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
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

	return withNamedMutation(mutation, "deleteChat", mutation.mutateAsync);
}

export function useRenameChat() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
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

	return withNamedMutation(mutation, "renameChat", mutation.mutateAsync);
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

	const mutation = useMutation({
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

	return withNamedMutation(mutation, "addChatMembers", mutation.mutateAsync);
}

export function useRemoveChatMember() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
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

	return withNamedMutation(mutation, "removeChatMember", mutation.mutateAsync);
}

export function useMarkAsRead() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
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
		onMutate: ({ chatId, characterId }) => {
			const lastReadAt = new Date().toISOString();
			const previousChats =
				queryClient.getQueryData<ChatWithMembers[]>(["chats"]) ?? [];
			const previousChatMembers =
				queryClient.getQueryData<ChatMember[]>(["chatMembers", chatId]) ?? [];

			queryClient.setQueryData<ChatWithMembers[]>(["chats"], (current = []) =>
				current.map((chat) =>
					chat.id !== chatId
						? chat
						: {
								...chat,
								members: chat.members.map((member) =>
									member.characterId === characterId
										? { ...member, lastReadAt }
										: member,
								),
							},
				),
			);

			queryClient.setQueryData<ChatMember[]>(
				["chatMembers", chatId],
				(current = []) =>
					current.map((member) =>
						member.characterId === characterId
							? { ...member, lastReadAt }
							: member,
					),
			);

			return {
				chatId,
				previousChats,
				previousChatMembers,
			};
		},
		onError: (_error, _variables, context) => {
			if (!context) return;
			queryClient.setQueryData(["chats"], context.previousChats);
			queryClient.setQueryData(
				["chatMembers", context.chatId],
				context.previousChatMembers,
			);
		},
		onSuccess: (_, { chatId }) => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
			queryClient.invalidateQueries({ queryKey: ["chatMembers", chatId] });
		},
	});

	return withNamedMutation(mutation, "markAsRead", mutation.mutateAsync);
}
