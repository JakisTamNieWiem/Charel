import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types/chat";

const PAGE_SIZE = 50;

export function useLatestMessages(chatIds: string[]) {
	return useQuery<Record<string, Message>>({
		queryKey: ["latestMessages", chatIds],
		queryFn: async () => {
			if (chatIds.length === 0) return {};

			const { data, error } = await supabase
				.from("Messages")
				.select("*, character:Characters!characterId(name, avatar)")
				.in("chat", chatIds)
				.order("created_at", { ascending: false });

			if (error) throw error;

			const latestByChat: Record<string, Message> = {};
			for (const msg of (data as Message[]) || []) {
				if (!latestByChat[msg.chat]) {
					latestByChat[msg.chat] = msg;
				}
			}
			return latestByChat;
		},
		enabled: chatIds.length > 0,
	});
}

export function useMessages(chatId: string) {
	return useInfiniteQuery<Message[]>({
		queryKey: ["messages", chatId],
		queryFn: async ({ pageParam }) => {
			let query = supabase
				.from("Messages")
				.select("*, character:Characters!characterId(name, avatar)")
				.eq("chat", chatId)
				.order("created_at", { ascending: false })
				.limit(PAGE_SIZE);

			if (pageParam) {
				query = query.lt("created_at", pageParam as string);
			}

			const { data, error } = await query;
			if (error) throw error;

			return (data as Message[]).reverse();
		},
		initialPageParam: null,
		getNextPageParam: (lastPage) => {
			if (lastPage.length < PAGE_SIZE) return undefined;
			return lastPage[0].created_at;
		},
		enabled: !!chatId,
	});
}

export function useEditMessage() {
	return useMutation({
		mutationFn: async ({
			messageId,
			content,
		}: {
			messageId: string;
			content: string;
		}) => {
			const { error } = await supabase
				.from("Messages")
				.update({ content, edited_at: new Date().toISOString() })
				.eq("id", messageId);
			if (error) throw error;
		},
	});
}

export function useDeleteMessage() {
	return useMutation({
		mutationFn: async (messageId: string) => {
			const { error } = await supabase
				.from("Messages")
				.delete()
				.eq("id", messageId);
			if (error) throw error;
		},
	});
}
