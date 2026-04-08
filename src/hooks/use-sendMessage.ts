import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useChatStore } from "@/store/useChatStore";

export function useSendMessage() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			content,
			characterId,
		}: {
			content: string;
			characterId: string;
		}) => {
			const { activeChatId, pendingCharacterId } = useChatStore.getState();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) throw new Error("No session");

			let chatId = activeChatId;

			// If no chat exists and we have a pending character, create 1:1 chat
			if (!chatId && pendingCharacterId) {
				const { data: newChat, error: chatError } = await supabase
					.from("Chats")
					.insert({ isGroup: false, ownerId: session.user.id })
					.select()
					.single();

				if (chatError || !newChat)
					throw chatError || new Error("Failed to create chat");

				chatId = newChat.id;

				// Add both members
				const members = [
					{ chatId, characterId, userId: session.user.id },
					{ chatId, characterId: pendingCharacterId, userId: session.user.id },
				];
				const uniqueMembers = Array.from(
					new Set(members.map((m) => m.characterId)),
				).map((cid) => {
					const m = members.find((m) => m.characterId === cid);
					if (!m) throw new Error("Member not found");
					return m;
				});

				const { error: memberError } = await supabase
					.from("ChatsMembers")
					.insert(uniqueMembers);
				if (memberError) throw memberError;

				useChatStore.setState({
					activeChatId: chatId,
					pendingCharacterId: null,
				});
				queryClient.invalidateQueries({ queryKey: ["chats"] });
			}

			if (!chatId) throw new Error("No active chat");

			const { data, error } = await supabase
				.from("Messages")
				.insert([
					{
						content,
						characterId,
						userId: session.user.id,
						chat: chatId,
					},
				])
				.select("*, character:Characters!characterId(name, avatar)")
				.single();

			if (error) throw error;

			supabase
				.from("Chats")
				.update({ lastMessageAt: new Date().toISOString() })
				.eq("id", chatId)
				.then();

			return { message: data, chatId };
		},
		onSuccess: ({ chatId }) => {
			queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
			queryClient.invalidateQueries({ queryKey: ["chats"] });
		},
	});
}
