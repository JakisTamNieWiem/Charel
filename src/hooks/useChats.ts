import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Chat, ChatMember, Contact } from "@/types/chat";
import type { Character } from "@/types/types";
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
			characters,
		}: {
			name: string | null;
			isGroup: boolean;
			characters: Character[];
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

			if (characters.length > 0) {
				const members = characters.map((character) => ({
					chatId: chatData.id,
					characterId: character.id,
					userId: character.ownerId,
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

export function useUpdateChatCover() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({
			chatId,
			cover,
			characterId,
		}: {
			chatId: string;
			cover: string;
			characterId: string;
		}) => {
			const { data: sessionData } = await supabase.auth.getSession();
			if (!sessionData.session) throw new Error("No session");

			const { error: coverError } = await supabase
				.from("Chats")
				.update({ cover })
				.eq("id", chatId);
			if (coverError) throw coverError;

			const { error: msgError } = await supabase.from("Messages").insert({
				id: crypto.randomUUID(),
				chat: chatId,
				content: "[system]Group photo was updated.[/system]",
				characterId,
				userId: sessionData.session.user.id,
			});
			if (msgError) throw msgError;
		},
		onSuccess: (_, { chatId }) => {
			queryClient.invalidateQueries({ queryKey: ["chats"] });
			queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
		},
	});

	return withNamedMutation(mutation, "updateChatCover", mutation.mutateAsync);
}

export function useUpdateContactNickname() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({
			fromId,
			toId,
			nickname,
		}: {
			fromId: string;
			toId: string;
			nickname: string | null;
		}) => {
			const { error } = await supabase
				.from("Contacts")
				.update({ nickname: nickname || null })
				.eq("fromId", fromId)
				.eq("toId", toId);
			if (error) throw error;
		},
		onSuccess: (_, { fromId }) => {
			queryClient.invalidateQueries({ queryKey: ["contacts", fromId] });
		},
	});

	return withNamedMutation(
		mutation,
		"updateContactNickname",
		mutation.mutateAsync,
	);
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
