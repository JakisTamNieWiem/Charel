import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect } from "react";
import { sendChatNotification } from "@/hooks/use-notifications";
import { getLocalAvatarPath } from "@/lib/avatar-cache";
import { supabase } from "@/lib/supabase";
import type {
	Message,
	RealtimeMessageDeletePayload,
	RealtimeMessagePayload,
} from "@/types/chat";

interface BroadcastChangePayload<TNew, TOld> {
	commit_timestamp?: string;
	errors?: string[];
	eventType?: "INSERT" | "UPDATE" | "DELETE";
	new: TNew;
	old: TOld;
	schema: string;
	table: string;
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

export function useActiveChatBroadcast(chatId: string | null) {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!chatId) return;

		const channel = supabase.channel(`chat:${chatId}`, {
			config: { private: true },
		});
		(channel as any)
			.on(
				"broadcast",
				{ event: "message.created" },
				(payload: BroadcastChangePayload<RealtimeMessagePayload, null>) => {
					const message = payload.new as Message;
					queryClient.setQueryData<InfiniteData<Message[], unknown>>(
						["messages", chatId],
						(current) => {
							if (
								current?.pages.flat().some((entry) => entry.id === message.id)
							) {
								return current;
							}
							return upsertMessageInPages(current, message);
						},
					);
					queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
					queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
					queryClient.invalidateQueries({ queryKey: ["chats"] });
				},
			)
			.on(
				"broadcast",
				{ event: "message.updated" },
				(payload: BroadcastChangePayload<RealtimeMessagePayload, null>) => {
					const message = payload.new as Message;
					queryClient.setQueryData<InfiniteData<Message[], unknown>>(
						["messages", chatId],
						(current) => upsertMessageInPages(current, message),
					);
					queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
					queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
				},
			)
			.on(
				"broadcast",
				{ event: "message.deleted" },
				(
					payload: BroadcastChangePayload<null, RealtimeMessageDeletePayload>,
				) => {
					const deletedId = payload.old?.id;
					if (deletedId) {
						queryClient.setQueryData<InfiniteData<Message[], unknown>>(
							["messages", chatId],
							(current) => {
								if (!current) return current;
								return {
									...current,
									pages: current.pages.map((page) =>
										page.filter((message) => message.id !== deletedId),
									),
								};
							},
						);
					}
					queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
					queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [chatId, queryClient]);
}

export function useUserChatListBroadcast(
	session: Session | null,
	activeChatId: string | null,
) {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!session) return;

		const channel = supabase.channel(`user:${session.user.id}:chat-list`, {
			config: { private: true },
		});
		(channel as any)
			.on(
				"broadcast",
				{ event: "chat-list.changed" },
				async (
					payload: BroadcastChangePayload<
						RealtimeMessagePayload | { id?: string; chat?: string },
						RealtimeMessageDeletePayload | { id?: string; chat?: string }
					>,
				) => {
					const chatId =
						payload.new?.chat ?? payload.old?.chat ?? activeChatId ?? undefined;
					const messageId = payload.new?.id;

					queryClient.invalidateQueries({ queryKey: ["chats"] });
					queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
					if (chatId) {
						queryClient.invalidateQueries({
							queryKey: ["chatMembers", chatId],
						});
					}

					const nextRow = payload.new;
					const authorUserId =
						nextRow && "userId" in nextRow ? nextRow.userId : undefined;

					if (
						payload.table !== "Messages" ||
						payload.eventType !== "INSERT" ||
						!messageId ||
						chatId === activeChatId ||
						document.hasFocus() ||
						authorUserId === session.user.id
					) {
						return;
					}

					const { data } = await supabase
						.from("Messages")
						.select("*, character:Characters!characterId(name, avatar)")
						.eq("id", messageId)
						.single();

					if (!data) return;
					const content = (data as Message).content;
					if (content.startsWith("[system]")) return;

					const preview = content.startsWith("[img]")
						? "sent an image"
						: content.length > 50
							? `${content.slice(0, 50)}...`
							: content;

					const { data: chatData } = await supabase
						.from("Chats")
						.select("isGroup, cover")
						.eq("id", data.chat)
						.single();

					const avatarUrl =
						chatData?.isGroup && chatData.cover
							? chatData.cover
							: data.character?.avatar;

					sendChatNotification({
						charName: data.character?.name || "Someone",
						body: preview,
						avatar: await getLocalAvatarPath(avatarUrl),
					});
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [activeChatId, queryClient, session]);
}
