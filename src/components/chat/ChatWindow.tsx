import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateHeader } from "@/lib/chat-utils";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import type { Message } from "@/types/chat";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import { AddMembersDialog, MembersDialog, RenameDialog } from "./GroupDialogs";
import MessageBubble from "./MessageBubble";

const EMPTY_MESSAGES: Message[] = [];

export default function ChatWindow() {
	const activeChatId = useChatStore((s) => s.activeChatId);
	const allMessages = useChatStore((s) => s.messages);
	const messages = useMemo(
		() => allMessages[activeChatId ?? ""] ?? EMPTY_MESSAGES,
		[allMessages, activeChatId],
	);
	const fetchMessages = useChatStore((s) => s.fetchMessages);
	const fetchOlderMessages = useChatStore((s) => s.fetchOlderMessages);
	const sendMessage = useChatStore((s) => s.sendMessage);
	const editMessage = useChatStore((s) => s.editMessage);
	const deleteMessage = useChatStore((s) => s.deleteMessage);
	const activeSpeakerId = useChatStore((s) => s.activeSpeakerId);
	const pendingCharacterId = useChatStore((s) => s.pendingCharacterId);
	const chats = useChatStore((s) => s.chats);
	const chatMembers = useChatStore((s) => s.chatMembers);
	const fetchChatMembers = useChatStore((s) => s.fetchChatMembers);
	const renameChat = useChatStore((s) => s.renameChat);
	const addChatMembers = useChatStore((s) => s.addChatMembers);
	const removeChatMember = useChatStore((s) => s.removeChatMember);
	const deleteChat = useChatStore((s) => s.deleteChat);
	const hasMore = useChatStore((s) => s.hasMore);
	const loadingMap = useChatStore((s) => s.loading);

	const characters = useGraphStore((s) => s.characters);

	const isLoading = activeChatId ? (loadingMap[activeChatId] ?? false) : false;
	const canLoadMore = activeChatId ? (hasMore[activeChatId] ?? false) : false;

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

	const activeChat = chats.find((c) => c.id === activeChatId);
	const pendingCharacter = pendingCharacterId
		? characters.find((c) => c.id === pendingCharacterId)
		: null;
	const members = activeChatId ? chatMembers[activeChatId] || [] : [];

	// Fetch messages and members on chat change
	useEffect(() => {
		if (activeChatId) {
			fetchMessages(activeChatId);
			fetchChatMembers(activeChatId);
		}
	}, [activeChatId, fetchMessages, fetchChatMembers]);

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
	});

	// Load older messages on scroll to top
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => {
			if (!activeChatId || !canLoadMore || isLoading) return;
			if (el.scrollTop < 100) {
				const prevHeight = el.scrollHeight;
				fetchOlderMessages(activeChatId).then(() => {
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
	}, [activeChatId, canLoadMore, isLoading, fetchOlderMessages]);

	// Handlers
	const handleSend = async () => {
		const content = draft.trim();
		if (!content || !activeSpeakerId) return;
		setDraft("");
		await sendMessage(content);
	};

	const handleSendImage = async (dataUrl: string) => {
		if (!activeSpeakerId) return;
		await sendMessage(`[img]${dataUrl}[/img]`);
	};

	const handleConfirmEdit = async () => {
		if (!editingId || !activeChatId) return;
		await editMessage(editingId, activeChatId, editContent);
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
					{isLoading && (
						<div className="flex justify-center py-4">
							<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
						</div>
					)}
					{canLoadMore && !isLoading && (
						<div className="flex justify-center py-2">
							<button
								onClick={() => activeChatId && fetchOlderMessages(activeChatId)}
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
									onDelete={() =>
										activeChatId && deleteMessage(msg.id, activeChatId)
									}
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
					activeChatId && removeChatMember(activeChatId, charId)
				}
			/>
			<RenameDialog
				open={showRename}
				onOpenChange={setShowRename}
				initialName={renameInitial}
				onRename={(name) => activeChatId && renameChat(activeChatId, name)}
			/>
			<AddMembersDialog
				open={showAddMembers}
				onOpenChange={setShowAddMembers}
				characters={characters}
				existingMemberIds={members.map((m) => m.characterId)}
				excludeId={activeSpeakerId}
				onAdd={(ids) => activeChatId && addChatMembers(activeChatId, ids)}
			/>
		</div>
	);
}
