import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import { useCallback } from "react";
import type { Chat, ChatMember, Message } from "@/types/chat";

interface ChatNotificationOptions {
	charName: string;
	body: string;
	avatar?: string | null;
}

export async function sendChatNotification({
	charName,
	body,
	avatar,
}: ChatNotificationOptions) {
	try {
		let granted = await isPermissionGranted();
		if (!granted) {
			const permission = await requestPermission();
			granted = permission === "granted";
		}
		if (granted) {
			sendNotification({
				title: charName,
				body,
				group: "charel-messages",
				autoCancel: true,
				attachments: avatar ? [{ id: "avatar", url: avatar }] : undefined,
			});
		}
	} catch (e) {
		console.error("Notification error:", e);
	}
}

export function getMessageNotificationPreview(content: string) {
	const trimmed = content.trim();

	if (trimmed.startsWith("[img]")) {
		return "sent an image";
	}

	if (
		/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?\S*)?/i.test(trimmed)
	) {
		return "sent an image";
	}

	const collapsed = trimmed.replace(/\s+/g, " ");

	return collapsed.length > 72 ? `${collapsed.slice(0, 72)}...` : collapsed;
}

export function useUnreadChats(
	activeSpeakerId: string | null,
	chats: (Chat & { members?: ChatMember[] })[],
	latestMessages: Record<string, Message>,
) {
	const isChatUnread = useCallback(
		(chatId: string): boolean => {
			if (!activeSpeakerId) return false;
			const chat = chats.find((c) => c.id === chatId);
			if (!chat) return false;
			const members = chat.members || [];
			const me = members.find((m) => m.characterId === activeSpeakerId);
			if (!me) return false;
			const lastMsg = latestMessages[chatId];
			if (!lastMsg) return false;
			if (lastMsg.characterId === activeSpeakerId) return false;
			if (!me.lastReadAt) return true;
			return new Date(lastMsg.created_at) > new Date(me.lastReadAt);
		},
		[activeSpeakerId, chats, latestMessages],
	);

	return { isChatUnread };
}
