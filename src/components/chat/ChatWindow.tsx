import type { IGif } from "@giphy/js-types";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	useAddChatMembers,
	useChatMembers,
	useChats,
	useDeleteChat,
	useRemoveChatMember,
	useRenameChat,
} from "@/hooks/use-chats";
import {
	useDeleteMessage,
	useEditMessage,
	useMessages,
} from "@/hooks/use-messages";
import { useSendMessage } from "@/hooks/use-sendMessage";
import { formatDateHeader } from "@/lib/chat-utils";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import type { Message } from "@/types/chat";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import { AddMembersDialog, MembersDialog, RenameDialog } from "./GroupDialogs";
import MessageBubble from "./MessageBubble";

export default function ChatWindow() {
	const activeChatId = useChatStore((s) => s.activeChatId);
	const activeSpeakerId = useChatStore((s) => s.activeSpeakerId);
	const pendingCharacterId = useChatStore((s) => s.pendingCharacterId);

	const {
		data: messagesData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useMessages(activeChatId ?? "");
	const { data: chats = [] } = useChats();
	const { data: members = [] } = useChatMembers(activeChatId ?? "");

	const { mutateAsync: sendMessage } = useSendMessage();
	const { mutateAsync: editMessage } = useEditMessage();
	const { mutateAsync: deleteMessage } = useDeleteMessage();
	const { mutateAsync: renameChat } = useRenameChat();
	const { mutateAsync: addChatMembers } = useAddChatMembers();
	const { mutateAsync: removeChatMember } = useRemoveChatMember();
	const { mutateAsync: deleteChat } = useDeleteChat();

	const messages = useMemo(
		() => messagesData?.pages.flat() ?? [],
		[messagesData],
	);
	const activeChat = useMemo(
		() => chats.find((c) => c.id === activeChatId),
		[chats, activeChatId],
	);

	const characters = useGraphStore((s) => s.characters);
	const pendingCharacter = useMemo(
		() =>
			pendingCharacterId
				? characters.find((c) => c.id === pendingCharacterId)
				: null,
		[characters, pendingCharacterId],
	);

	const [draft, setDraft] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editContent, setEditContent] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Group management dialog state
	const [showMembers, setShowMembers] = useState(false);
	const [showRename, setShowRename] = useState(false);
	const [showAddMembers, setShowAddMembers] = useState(false);
	const [renameInitial, setRenameInitial] = useState("");

	// Auto-scroll to bottom on new messages
	const prevCount = useRef(0);
	useEffect(() => {
		if (messages.length > prevCount.current) {
			setTimeout(
				() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
				50,
			);
		}
		prevCount.current = messages.length;
	}, [messages]);

	// Load older messages on scroll to top
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => {
			if (!activeChatId || !hasNextPage || isFetchingNextPage) return;
			if (el.scrollTop < 100) {
				const prevHeight = el.scrollHeight;
				fetchNextPage().then(() => {
					requestAnimationFrame(() => {
						if (scrollRef.current) {
							scrollRef.current.scrollTop =
								scrollRef.current.scrollHeight - prevHeight;
						}
					});
				});
			}
		};
		el.addEventListener("scroll", onScroll);
		return () => el.removeEventListener("scroll", onScroll);
	}, [activeChatId, hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Handlers
	const handleSend = async () => {
		const content = draft.trim();
		if (!content || !activeSpeakerId) return;
		setDraft("");
		await sendMessage({ content, characterId: activeSpeakerId });
	};

	const handleSendImage = async (dataUrl: string) => {
		if (!activeSpeakerId) return;
		await sendMessage({
			content: `[img]${dataUrl}[/img]`,
			characterId: activeSpeakerId,
		});
	};

	const handleSendGif = async (gif: IGif) => {
		if (!activeSpeakerId) return;
		await sendMessage({
			content: `[img]${gif.images.original.url}[/img]`,
			characterId: activeSpeakerId,
		});
	};

	const handleConfirmEdit = async () => {
		if (!editingId || !activeChatId) return;
		await editMessage({ messageId: editingId, content: editContent });
		setEditingId(null);
		setEditContent("");
	};

	// Empty state
	if (!activeChatId && !pendingCharacter) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				<div className="text-center">
					<p className="text-lg font-medium mb-1">No chat selected</p>
					<p className="text-xs opacity-60">
						Pick a conversation from the sidebar
					</p>
				</div>
			</div>
		);
	}

	// Compute header name
	const headerName = (() => {
		if (pendingCharacter) return pendingCharacter.name;
		if (!activeChat) return "Chat";
		if (!activeChat.isGroup) {
			const other = members.find((m) => m.characterId !== activeSpeakerId);
			if (other) {
				const char = characters.find((c) => c.id === other.characterId);
				if (char) return char.name;
			}
		}
		return activeChat.name || "Chat";
	})();

	// Group messages by date
	const groupedMessages: { date: string; msgs: Message[] }[] = [];
	for (const msg of messages) {
		const dateKey = new Date(msg.created_at).toDateString();
		const last = groupedMessages[groupedMessages.length - 1];
		if (last && last.date === dateKey) {
			last.msgs.push(msg);
		} else {
			groupedMessages.push({ date: dateKey, msgs: [msg] });
		}
	}

	const speakerName =
		characters.find((c) => c.id === activeSpeakerId)?.name ?? "character";

	return (
		<div className="flex flex-col h-full">
			<ChatHeader
				headerName={headerName}
				isGroup={activeChat?.isGroup ?? false}
				chatId={activeChatId}
				members={members}
				onShowMembers={() => setShowMembers(true)}
				onShowAddMembers={() => setShowAddMembers(true)}
				onShowRename={(name) => {
					setRenameInitial(name);
					setShowRename(true);
				}}
				onDelete={() => activeChatId && deleteChat(activeChatId)}
			/>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
				<div className="px-6 py-4 space-y-1">
					{isFetchingNextPage && (
						<div className="flex justify-center py-4">
							<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
						</div>
					)}
					{hasNextPage && !isFetchingNextPage && (
						<div className="flex justify-center py-2">
							<button
								onClick={() => fetchNextPage()}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								Load older messages
							</button>
						</div>
					)}
					{groupedMessages.map((group) => (
						<div key={group.date}>
							<div className="flex items-center gap-3 my-4">
								<div className="flex-1 h-px bg-white/10" />
								<span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
									{formatDateHeader(group.msgs[0].created_at)}
								</span>
								<div className="flex-1 h-px bg-white/10" />
							</div>
							{group.msgs.map((msg) => (
								<MessageBubble
									key={msg.id}
									msg={msg}
									characters={characters}
									isEditing={editingId === msg.id}
									editContent={editContent}
									onEditContentChange={setEditContent}
									onStartEdit={() => {
										setEditingId(msg.id);
										setEditContent(msg.content);
									}}
									onConfirmEdit={handleConfirmEdit}
									onCancelEdit={() => {
										setEditingId(null);
										setEditContent("");
									}}
									onDelete={() => deleteMessage(msg.id)}
								/>
							))}
						</div>
					))}
					<div ref={messagesEndRef} />
				</div>
			</div>

			{/* Input area */}
			<div className="shrink-0 px-6 py-3 border-t border-white/10 bg-background/60 backdrop-blur-md">
				<ChatInput
					draft={draft}
					onDraftChange={setDraft}
					onSend={handleSend}
					onSendImage={handleSendImage}
					onSendGif={handleSendGif}
					disabled={!activeSpeakerId}
					placeholder={
						activeSpeakerId
							? `Message as ${speakerName}...`
							: "Select a character to speak as..."
					}
				/>
			</div>

			{/* Group management dialogs */}
			<MembersDialog
				open={showMembers}
				onOpenChange={setShowMembers}
				members={members}
				characters={characters}
				activeSpeakerId={activeSpeakerId}
				onRemoveMember={(charId) =>
					activeChatId &&
					removeChatMember({ chatId: activeChatId, characterId: charId })
				}
			/>
			<RenameDialog
				open={showRename}
				onOpenChange={setShowRename}
				initialName={renameInitial}
				onRename={(name) =>
					activeChatId && renameChat({ chatId: activeChatId, name })
				}
			/>
			<AddMembersDialog
				open={showAddMembers}
				onOpenChange={setShowAddMembers}
				characters={characters}
				existingMemberIds={members.map((m) => m.characterId)}
				excludeId={activeSpeakerId}
				onAdd={(ids) =>
					activeChatId &&
					addChatMembers({ chatId: activeChatId, characterIds: ids })
				}
			/>
		</div>
	);
}
