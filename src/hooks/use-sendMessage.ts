import {
	type InfiniteData,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useChatStore } from "@/store/useChatStore";
import type { Message } from "@/types/chat";
import { withNamedMutation } from "./mutation-utils";

interface SendMessageInput {
	content: string;
	characterId: string;
}

interface SendMessageVariables extends SendMessageInput {
	id: string;
}

interface SendMessageResult {
	message: Message;
	chatId: string;
	id: string;
}

function createOptimisticMessage({
	chatId,
	content,
	characterId,
	userId,
	id,
}: {
	chatId: string;
	content: string;
	characterId: string;
	userId: string;
	id: string;
}): Message {
	return {
		id,
		chat: chatId,
		content,
		characterId,
		userId,
		created_at: new Date().toISOString(),
		edited_at: null,
		_pending: true,
	};
}

function upsertMessageInPages(
	data: InfiniteData<Message[], unknown> | undefined,
	message: Message,
): InfiniteData<Message[], unknown> {
	if (!data || data.pages.length === 0) {
		return {
			pages: [[message]],
			pageParams: [null],
		};
	}

	let found = false;
	const pages = data.pages.map((page) =>
		page.map((existing) => {
			if (existing.id !== message.id) return existing;
			found = true;
			return message;
		}),
	);

	if (found) {
		return {
			...data,
			pages,
		};
	}

	const lastPageIndex = pages.length - 1;
	pages[lastPageIndex] = [...pages[lastPageIndex], message];

	return {
		...data,
		pages,
	};
}

export function useSendMessage() {
	const queryClient = useQueryClient();
	const addPendingMessage = useChatStore((s) => s.addPendingMessage);
	const removePendingMessage = useChatStore((s) => s.removePendingMessage);

	const mutation = useMutation<SendMessageResult, Error, SendMessageVariables>({
		mutationFn: async ({ content, characterId, id }) => {
			const { activeChatId, pendingCharacterId } = useChatStore.getState();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) throw new Error("No session found. Please log in.");

			let chatId = activeChatId;
			let shouldAddPendingAfterChatCreation = false;

			// If no chat exists and we have a pending character, create 1:1 chat
			if (!chatId && pendingCharacterId) {
				// 1. Create the Chat
				const { data: newChat, error: chatError } = await supabase
					.from("Chats")
					.insert({
						name: "New Chat", // Provide a default name just in case it's required
						isGroup: false,
						ownerId: session.user.id,
					})
					.select()
					.single();

				if (chatError || !newChat) {
					console.error("Error creating chat:", chatError);
					throw chatError || new Error("Failed to create chat");
				}

				chatId = newChat.id;

				// 2. Add members
				const membersToAdd = [
					{ chatId, characterId, userId: session.user.id },
					{ chatId, characterId: pendingCharacterId, userId: session.user.id },
				];

				// Deduplicate in case of self-chat
				const uniqueMembers = Array.from(
					new Set(membersToAdd.map((m) => m.characterId)),
				).map((cid) => {
					const m = membersToAdd.find((member) => member.characterId === cid);
					if (!m)
						throw new Error("Internal error: member deduplication failed");
					return m;
				});

				const { error: memberError } = await supabase
					.from("ChatsMembers")
					.insert(uniqueMembers);

				if (memberError) {
					console.error("Error adding chat members:", memberError);
					throw memberError;
				}

				// Update global UI state immediately so subsequent logic sees the new chatId
				useChatStore.setState({
					activeChatId: chatId,
					pendingCharacterId: null,
				});
				shouldAddPendingAfterChatCreation = true;

				// Optional: invalidate in background
				queryClient.invalidateQueries({ queryKey: ["chats"] });
			}

			if (!chatId) throw new Error("No active chat conversation selected.");

			if (shouldAddPendingAfterChatCreation) {
				addPendingMessage(
					createOptimisticMessage({
						chatId,
						content,
						characterId,
						userId: session.user.id,
						id,
					}),
				);
			}

			// 3. Insert the Message
			const { data, error } = await supabase
				.from("Messages")
				.insert({
					id,
					content,
					characterId,
					userId: session.user.id,
					chat: chatId,
				})
				.select("*, character:Characters!characterId(name, avatar)")
				.single();

			if (error) {
				console.error("Error sending message:", error);
				throw error;
			}

			return { message: data as Message, chatId, id };
		},
		onMutate: async (variables) => {
			const { activeChatId } = useChatStore.getState();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (activeChatId && session) {
				addPendingMessage(
					createOptimisticMessage({
						chatId: activeChatId,
						content: variables.content,
						characterId: variables.characterId,
						userId: session.user.id,
						id: variables.id,
					}),
				);
			}
		},
		onSuccess: ({ chatId, id, message }) => {
			queryClient.setQueryData<InfiniteData<Message[], unknown>>(
				["messages", chatId],
				(current) => upsertMessageInPages(current, message),
			);
			removePendingMessage(id);
			queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
			queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
			queryClient.invalidateQueries({ queryKey: ["chats"] });
		},
		onError: (err, variables) => {
			removePendingMessage(variables.id);
			console.error("Mutation failed:", err);
		},
	});

	const sendMessage = (input: SendMessageInput) =>
		mutation.mutateAsync({
			...input,
			id: crypto.randomUUID(),
		});

	return withNamedMutation(mutation, "sendMessage", sendMessage);
}
