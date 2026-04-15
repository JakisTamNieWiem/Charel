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

	pages[0] = [...pages[0], message];

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
			const { activeChatId } = useChatStore.getState();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) throw new Error("No session found. Please log in.");

			const chatId = activeChatId;
			if (!chatId) {
				throw new Error(
					"No active chat conversation selected. Wait for the direct chat to be created before sending a message.",
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
