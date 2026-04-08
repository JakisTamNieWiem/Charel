import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types/chat";

export function useSendMessage(chatId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (newMessage: {
			content: string;
			userId: string;
			characterId: string;
		}) => {
			const { data, error } = await supabase
				.from("Messages")
				.insert([{ ...newMessage, chat: chatId }])
				.select()
				.single();

			if (error) throw error;
			return data;
		},

		// 1. The moment the user clicks "Send"
		onMutate: async (newMessage) => {
			// Cancel outgoing refetches (so they don't overwrite our optimistic update)
			await queryClient.cancelQueries({ queryKey: ["messages", chatId] });

			// Snapshot the current list
			const previousMessages = queryClient.getQueryData(["messages", chatId]);

			// Optimistically update the cache
			queryClient.setQueryData(["messages", chatId], (old: Message[]) => [
				...(old || []),
				{
					...newMessage,
					id: Math.random(),
					created_at: new Date().toISOString(),
					status: "sending",
				},
			]);

			return { previousMessages };
		},

		// 2. If the request fails, roll back to the previous state
		onError: (_err, _newMessage, context) => {
			queryClient.setQueryData(["messages", chatId], context?.previousMessages);
		},

		// 3. Always refetch after error or success to ensure synchronization
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
		},
	});
}
