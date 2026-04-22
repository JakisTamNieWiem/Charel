import { useCallback } from "react";
import { getDesktopApi } from "@/lib/desktop";
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
		const desktop = getDesktopApi();
		if (desktop) {
			let granted = await desktop.notification.isPermissionGranted();
			if (!granted) {
				const permission = await desktop.notification.requestPermission();
				granted = permission === "granted";
			}
			if (granted) {
				await desktop.notification.send({
					title: charName,
					body,
					avatar,
				});
			}
			return;
		}

		if (typeof window === "undefined" || !("Notification" in window)) {
			return;
		}

		let permission = Notification.permission;
		if (permission === "default") {
			permission = await Notification.requestPermission();
		}

		if (permission === "granted") {
			new Notification(charName, {
				body,
				icon: avatar ?? undefined,
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
