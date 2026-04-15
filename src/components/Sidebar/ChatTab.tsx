import {
	Check,
	ImagePlus,
	MessageCirclePlus,
	Pencil,
	Plus,
	PlusIcon,
	Search,
	Trash2,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	AddMembersDialog,
	ChangeCoverDialog,
	MembersDialog,
	RenameDialog,
} from "@/components/chat/GroupDialogs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	useAddChatMembers,
	useAddContacts,
	useChats,
	useContacts,
	useCreateChat,
	useDeleteChat,
	useRemoveChatMember,
	useRenameChat,
	useUpdateChatCover,
	useUpdateContactNickname,
} from "@/hooks/use-chats";
import { useLatestMessages } from "@/hooks/use-messages";
import { useUnreadChats } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import type { Chat, ChatMember } from "@/types/chat";
import type { Character } from "@/types/types";

function sortCharactersByConversation(
	characters: Character[],
	directChatMap: Map<string, string>,
	chats: (Chat & { members?: ChatMember[] })[],
) {
	return [...characters].sort((a, b) => {
		const aChatId = directChatMap.get(a.id);
		const bChatId = directChatMap.get(b.id);
		const aChat = chats.find((c) => c.id === aChatId);
		const bChat = chats.find((c) => c.id === bChatId);

		const aTime = aChat?.lastMessageAt;
		const bTime = bChat?.lastMessageAt;

		if (aTime && bTime) return bTime.localeCompare(aTime);
		if (aTime) return -1;
		if (bTime) return 1;
		return a.name.localeCompare(b.name);
	});
}

export default function ChatTab() {
	const { data: profile } = useProfile();
	const { data: chats = [] } = useChats();
	const chatIds = useMemo(() => chats.map((c) => c.id), [chats]);
	const { data: latestMessages = {} } = useLatestMessages(chatIds);

	const activeChatId = useChatStore((s) => s.activeChatId);
	const pendingCharacterId = useChatStore((s) => s.pendingCharacterId);
	const setActiveChatId = useChatStore((s) => s.setActiveChatId);
	const setPendingCharacterId = useChatStore((s) => s.setPendingCharacterId);
	const activeSpeakerId = useChatStore((s) => s.activeSpeakerId);
	const setActiveSpeakerId = useChatStore((s) => s.setActiveSpeakerId);

	const { createChat } = useCreateChat();
	const { addContacts } = useAddContacts();
	const { updateContactNickname } = useUpdateContactNickname();
	const { deleteChat } = useDeleteChat();
	const { renameChat } = useRenameChat();
	const { addChatMembers } = useAddChatMembers();
	const { removeChatMember } = useRemoveChatMember();
	const { updateChatCover } = useUpdateChatCover();
	const { data: contacts = [] } = useContacts(activeSpeakerId ?? "");

	const characters = useGraphStore((s) => s.characters);
	const activeChar = characters.find((c) => c.id === activeSpeakerId);
	const activeSpeaker =
		characters.find((c) => c.id === activeSpeakerId) ?? null;
	const contactIds = useMemo(
		() => new Set(contacts.map((contact) => contact.toId)),
		[contacts],
	);

	const nicknameMap = useMemo(
		() =>
			new Map(
				contacts
					.filter((c) => c.nickname)
					.map((c) => [c.toId, c.nickname as string]),
			),
		[contacts],
	);

	const contactMap = useMemo(
		() => new Map(contacts.map((c) => [c.toId, c])),
		[contacts],
	);

	const [editingNicknameId, setEditingNicknameId] = useState<string | null>(
		null,
	);
	const [editingNicknameValue, setEditingNicknameValue] = useState("");
	const [search, setSearch] = useState("");
	const [showNewChat, setShowNewChat] = useState(false);
	const [showAddContact, setShowAddContact] = useState(false);
	const [selectedCreateIds, setSelectedCreateIds] = useState<string[]>([]);
	const [createSearch, setCreateSearch] = useState("");
	const [newGroupName, setNewGroupName] = useState("");
	const [contactSearch, setContactSearch] = useState("");
	const [managedGroupChatId, setManagedGroupChatId] = useState<string | null>(
		null,
	);
	const [showMembers, setShowMembers] = useState(false);
	const [showRename, setShowRename] = useState(false);
	const [showAddMembers, setShowAddMembers] = useState(false);
	const [showChangeCover, setShowChangeCover] = useState(false);
	const [renameInitial, setRenameInitial] = useState("");

	const isAnon =
		!profile?.role || (profile.role !== "dm" && profile.role !== "player");

	const resetCreateDialog = () => {
		setSelectedCreateIds([]);
		setCreateSearch("");
		setNewGroupName("");
	};

	const saveNickname = async (toId: string) => {
		if (!activeSpeakerId) return;
		await updateContactNickname({
			fromId: activeSpeakerId,
			toId,
			nickname: editingNicknameValue.trim() || null,
		});
		setEditingNicknameId(null);
		setEditingNicknameValue("");
	};

	useEffect(() => {
		if (!activeSpeakerId && characters.length > 0 && profile) {
			const mine = characters.filter((c) => c.ownerId === profile.userId);
			if (mine.length > 0) {
				setActiveSpeakerId(mine[0].id);
			}
		}
	}, [activeSpeakerId, characters, setActiveSpeakerId, profile]);

	useEffect(() => {
		if (!activeSpeakerId) return;
		setActiveChatId(null);
		setPendingCharacterId(null);
	}, [activeSpeakerId, setActiveChatId, setPendingCharacterId]);

	const directChatMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const chat of chats) {
			if (chat.isGroup) continue;
			const members = chat.members || [];
			const isMember = members.some((m) => m.characterId === activeSpeakerId);
			if (!isMember) continue;
			for (const m of members) {
				if (m.characterId !== activeSpeakerId) {
					map.set(m.characterId, chat.id);
				}
			}
		}
		return map;
	}, [chats, activeSpeakerId]);

	useEffect(() => {
		if (!pendingCharacterId) return;
		const resolvedChatId = directChatMap.get(pendingCharacterId);
		if (resolvedChatId) {
			setActiveChatId(resolvedChatId);
		}
	}, [pendingCharacterId, directChatMap, setActiveChatId]);

	const contactCharacters = useMemo(
		() =>
			characters.filter(
				(char) =>
					char.id !== activeSpeakerId &&
					!!char.phoneNumber?.trim() &&
					contactIds.has(char.id),
			),
		[characters, activeSpeakerId, contactIds],
	);

	const sortedContactCharacters = useMemo(
		() => sortCharactersByConversation(contactCharacters, directChatMap, chats),
		[contactCharacters, directChatMap, chats],
	);

	const groupChats = useMemo(
		() =>
			chats.filter(
				(chat) =>
					chat.isGroup &&
					(chat.members || []).some((m) => m.characterId === activeSpeakerId),
			),
		[chats, activeSpeakerId],
	);

	const filteredCharacters = useMemo(() => {
		if (!search) return sortedContactCharacters;
		const q = search.toLowerCase();
		return sortedContactCharacters.filter((c) =>
			c.name.toLowerCase().includes(q),
		);
	}, [sortedContactCharacters, search]);

	const filteredGroups = useMemo(() => {
		if (!search) return groupChats;
		const q = search.toLowerCase();
		return groupChats.filter((c) => {
			if (c.name?.toLowerCase().includes(q)) return true;
			const members = c.members || [];
			return members.some((m) => {
				const char = characters.find((ch) => ch.id === m.characterId);
				return char?.name.toLowerCase().includes(q);
			});
		});
	}, [groupChats, search, characters]);

	const createCandidates = useMemo(() => {
		if (!createSearch) return sortedContactCharacters;
		const q = createSearch.toLowerCase();
		return sortedContactCharacters.filter((char) => {
			const nickname = nicknameMap.get(char.id)?.toLowerCase();
			return (
				char.name.toLowerCase().includes(q) ||
				!!nickname?.includes(q) ||
				char.phoneNumber?.toLowerCase().includes(q)
			);
		});
	}, [createSearch, nicknameMap, sortedContactCharacters]);

	const selectedCreateCharacters = useMemo(
		() =>
			selectedCreateIds
				.map((id) => characters.find((char) => char.id === id) ?? null)
				.filter((char): char is Character => char !== null),
		[characters, selectedCreateIds],
	);

	const managedGroupChat = useMemo(
		() => groupChats.find((chat) => chat.id === managedGroupChatId) ?? null,
		[groupChats, managedGroupChatId],
	);
	const managedGroupMembers = managedGroupChat?.members ?? [];

	useEffect(() => {
		if (managedGroupChatId && !managedGroupChat) {
			setManagedGroupChatId(null);
			setShowMembers(false);
			setShowRename(false);
			setShowAddMembers(false);
			setShowChangeCover(false);
		}
	}, [managedGroupChat, managedGroupChatId]);

	const getGroupDisplayName = (chat: Chat & { members?: ChatMember[] }) => {
		if (chat.name) return chat.name;
		const members = chat.members || [];
		const names = members
			.map((m) => characters.find((c) => c.id === m.characterId)?.name)
			.filter(Boolean);
		return names.join(", ") || "Group chat";
	};

	const getLastMessagePreview = (chatId: string) => {
		const last = latestMessages[chatId];
		if (!last) return null;
		if (last.content.startsWith("[system]")) {
			const inner =
				last.content.match(/^\[system\](.*)\[\/system\]$/s)?.[1] ?? "";
			return inner;
		}
		if (last.content.startsWith("[img]")) return "Image";
		if (
			/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?\S*)?/i.test(
				last.content,
			)
		) {
			return "Image";
		}
		return last.content.length > 30
			? `${last.content.slice(0, 30)}...`
			: last.content;
	};

	const getGroupLastMessagePreview = (chatId: string) => {
		const last = latestMessages[chatId];
		if (!last) return null;
		const preview = getLastMessagePreview(chatId);
		if (!preview) return null;
		if (last.content.startsWith("[system]")) return preview;
		const senderName =
			nicknameMap.get(last.characterId) ??
			characters.find((c) => c.id === last.characterId)?.name ??
			"Unknown";
		return `${senderName}: ${preview}`;
	};

	const { isChatUnread } = useUnreadChats(
		activeSpeakerId,
		chats,
		latestMessages,
	);

	const handleCharacterClick = (charId: string) => {
		const existingChatId = directChatMap.get(charId);
		if (existingChatId) {
			setActiveChatId(existingChatId);
		} else {
			setPendingCharacterId(charId);
		}
	};

	const handleCreateDialogOpenChange = (open: boolean) => {
		setShowNewChat(open);
		if (!open) {
			resetCreateDialog();
		}
	};

	const handleToggleCreateSelection = (charId: string) => {
		setSelectedCreateIds((current) =>
			current.includes(charId)
				? current.filter((id) => id !== charId)
				: [...current, charId],
		);
	};

	const handleCreateConversation = async () => {
		if (!activeSpeakerId || selectedCreateIds.length === 0) return;

		if (selectedCreateIds.length === 1) {
			handleCharacterClick(selectedCreateIds[0]);
			handleCreateDialogOpenChange(false);
			return;
		}

		if (!activeSpeaker) return;

		const charactersToAdd = [activeSpeaker, ...selectedCreateCharacters];
		const chatId = await createChat({
			name: newGroupName.trim() || null,
			isGroup: true,
			characters: charactersToAdd,
		});

		if (chatId) {
			setActiveChatId(chatId);
		}
		handleCreateDialogOpenChange(false);
	};

	const handleOpenNicknameEditor = (char: Character) => {
		setShowAddContact(true);
		setContactSearch(char.name);
		setEditingNicknameId(char.id);
		setEditingNicknameValue(contactMap.get(char.id)?.nickname ?? "");
	};

	const openGroupAction = (
		chat: Chat & { members?: ChatMember[] },
		action: "members" | "add" | "rename" | "cover",
	) => {
		setManagedGroupChatId(chat.id);
		setActiveChatId(chat.id);
		if (action === "members") {
			setShowMembers(true);
			return;
		}
		if (action === "add") {
			setShowAddMembers(true);
			return;
		}
		if (action === "rename") {
			setRenameInitial(chat.name || getGroupDisplayName(chat));
			setShowRename(true);
			return;
		}
		setShowChangeCover(true);
	};

	const availableContacts = useMemo(() => {
		const sorted = characters
			.filter(
				(char) =>
					char.id !== activeSpeakerId &&
					!!char.phoneNumber?.trim() &&
					contactIds.has(char.id),
			)
			.sort((a, b) => a.name.localeCompare(b.name));

		if (!contactSearch) return sorted;
		const q = contactSearch.toLowerCase();
		return sorted.filter(
			(char) =>
				char.name.toLowerCase().includes(q) ||
				char.phoneNumber?.toLowerCase().includes(q),
		);
	}, [characters, activeSpeakerId, contactIds, contactSearch]);

	const createActionLabel =
		selectedCreateIds.length <= 1 ? "Start chat" : "Create group";
	const createActionDescription =
		selectedCreateIds.length <= 1
			? "Choose one contact to jump into a direct conversation."
			: "Select multiple contacts to spin up a group thread.";

	if (isAnon) {
		return (
			<div className="p-4">
				<h2 className="text-xs font-mono uppercase tracking-widest opacity-50 mb-4">
					Chat
				</h2>
				<p className="text-sm text-muted-foreground mb-3">
					Log in as a player or DM to access chat.
				</p>
				<p className="text-[10px] font-mono uppercase tracking-widest opacity-30 mb-2">
					Characters
				</p>
				{characters.map((c) => (
					<div key={c.id} className="flex items-center gap-2 px-2 py-1.5">
						<Avatar className="size-6">
							<AvatarImage src={c.avatar ?? undefined} />
							<AvatarFallback className="text-[8px]">
								{c.name[0]}
							</AvatarFallback>
						</Avatar>
						<span className="text-xs truncate">{c.name}</span>
					</div>
				))}
			</div>
		);
	}

	return (
		<div>
			<div className="p-2 pr-0 min-h-9 flex items-center justify-between sticky top-0 bg-sidebar z-50">
				<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
					Chats
				</h2>
				<div className="flex items-center gap-1">
					<Button
						onClick={() => setShowAddContact(true)}
						variant="ghost"
						title="Add contact"
						disabled={!activeSpeakerId}
					>
						<UserPlus className="w-4 h-4" />
					</Button>
					<Button
						onClick={() => handleCreateDialogOpenChange(true)}
						variant="ghost"
						title="Start conversation"
						disabled={!activeSpeakerId}
					>
						<Plus className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="px-1 pb-2">
				<label className="text-[10px] font-mono uppercase tracking-widest opacity-30 mb-1 block">
					Speaking as
				</label>
				<Combobox
					value={activeChar?.name ?? ""}
					onValueChange={(val) => {
						if (val) {
							const char = characters.find((c) => c.id === val);
							if (char) setActiveSpeakerId(char.id);
						}
					}}
					items={characters.filter((c) => c.ownerId === profile?.userId)}
				>
					<ComboboxInput
						placeholder="Select character..."
						className="h-8 text-xs"
					/>
					<ComboboxContent>
						<ComboboxEmpty>No characters found</ComboboxEmpty>
						<ComboboxList>
							{(char: (typeof characters)[number]) => (
								<ComboboxItem key={char.id} value={char.id}>
									<Avatar className="size-5 shrink-0">
										<AvatarImage src={char.avatar ?? undefined} />
										<AvatarFallback className="text-[7px]">
											{char.name[0]}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm">{char.name}</span>
								</ComboboxItem>
							)}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</div>

			<div className="pb-2 mb-3 px-1">
				<div className="relative">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
					<Input
						placeholder="Search..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-7 pl-7 text-xs bg-white/5 border-white/10"
					/>
				</div>
			</div>

			<div className="mb-3">
				<p className="text-[10px] font-mono uppercase tracking-widest opacity-30 px-1 mb-1">
					Group Chats ({groupChats.length})
				</p>
				{filteredGroups.map((chat) => (
					<ContextMenu key={chat.id}>
						<ContextMenuTrigger className="block">
							<div
								onClick={() => setActiveChatId(chat.id)}
								className={cn(
									"group/chat px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer flex items-center relative",
									"active:scale-[0.99] active:bg-(--sidebar-foreground)/7",
									activeChatId === chat.id
										? [
												"bg-(--sidebar-foreground)/5 border-(--sidebar-foreground)/10",
												"shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.4)]",
											]
										: "bg-transparent border-transparent hover:bg-(--sidebar-foreground)/5",
								)}
							>
								<div className="size-8 mr-3 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
									{chat.cover ? (
										<img
											src={chat.cover}
											alt=""
											className="w-full h-full object-cover"
										/>
									) : (
										<Users className="w-3.5 h-3.5 text-muted-foreground" />
									)}
								</div>
								<div className="flex-1 min-w-0">
									<h3 className="text-sm font-medium truncate">
										{getGroupDisplayName(chat)}
									</h3>
									<p className="text-[10px] opacity-30 truncate">
										{getGroupLastMessagePreview(chat.id) ?? "No messages yet"}
									</p>
								</div>
								{isChatUnread(chat.id) && (
									<span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2 w-2">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
										<span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
									</span>
								)}
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem onClick={() => setActiveChatId(chat.id)}>
								<MessageCirclePlus /> Open chat
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem onClick={() => openGroupAction(chat, "members")}>
								<Users /> View members
							</ContextMenuItem>
							<ContextMenuItem onClick={() => openGroupAction(chat, "add")}>
								<UserPlus /> Add members
							</ContextMenuItem>
							<ContextMenuItem onClick={() => openGroupAction(chat, "rename")}>
								<Pencil /> Rename chat
							</ContextMenuItem>
							<ContextMenuItem onClick={() => openGroupAction(chat, "cover")}>
								<ImagePlus /> Change cover
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem
								variant="destructive"
								onClick={() => deleteChat(chat.id)}
							>
								<Trash2 /> Delete chat
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				))}
			</div>

			<div>
				<p className="text-[10px] font-mono uppercase tracking-widest opacity-30 px-1 mb-1">
					Direct Chats ({contactCharacters.length})
				</p>
				{contactCharacters.length === 0 && (
					<p className="px-3 py-2 text-xs text-muted-foreground">
						Add contacts to start a conversation with this speaker.
					</p>
				)}
				{filteredCharacters.map((char) => {
					const existingChatId = directChatMap.get(char.id);
					const isActive = existingChatId
						? activeChatId === existingChatId
						: pendingCharacterId === char.id;

					return (
						<ContextMenu key={char.id}>
							<ContextMenuTrigger className="block">
								<div
									onClick={() => handleCharacterClick(char.id)}
									className={cn(
										"px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer flex items-center relative",
										"active:scale-[0.99] active:bg-(--sidebar-foreground)/7",
										isActive
											? [
													"bg-(--sidebar-foreground)/5 border-(--sidebar-foreground)/10",
													"shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.4)]",
												]
											: "bg-transparent border-transparent hover:bg-(--sidebar-foreground)/5",
									)}
								>
									<Avatar className="size-10 mr-3 shrink-0">
										<AvatarImage src={char.avatar ?? undefined} />
										<AvatarFallback>{char.name[0]}</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<h3 className="text-sm font-medium truncate">
											{nicknameMap.get(char.id) ?? char.name}
										</h3>
										<p className="text-[10px] opacity-30 truncate">
											{existingChatId
												? (getLastMessagePreview(existingChatId) ??
													"No messages yet")
												: "Ready to start chatting"}
										</p>
									</div>
									{existingChatId && isChatUnread(existingChatId) && (
										<span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2 w-2">
											<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
											<span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
										</span>
									)}
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem onClick={() => handleCharacterClick(char.id)}>
									<MessageCirclePlus />
									{existingChatId ? "Open chat" : "Start chat"}
								</ContextMenuItem>
								<ContextMenuItem onClick={() => handleOpenNicknameEditor(char)}>
									<Pencil /> Edit nickname
								</ContextMenuItem>
								{existingChatId && (
									<>
										<ContextMenuSeparator />
										<ContextMenuItem
											variant="destructive"
											onClick={() => deleteChat(existingChatId)}
										>
											<Trash2 /> Delete chat
										</ContextMenuItem>
									</>
								)}
							</ContextMenuContent>
						</ContextMenu>
					);
				})}
			</div>

			<Dialog
				open={showAddContact}
				onOpenChange={(open) => {
					setShowAddContact(open);
					if (!open) {
						setContactSearch("");
						setEditingNicknameId(null);
						setEditingNicknameValue("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Contacts</DialogTitle>
					</DialogHeader>
					<div className="space-y-6 min-h-96! flex flex-col">
						<Input
							placeholder="Search characters or phone numbers..."
							value={contactSearch}
							onChange={(e) => setContactSearch(e.target.value)}
							className="h-12 text-md"
						/>
						<ScrollArea className="h-full max-h-96 overflow-y-auto space-y-1 bg-background overflow-visible rounded-md p-1">
							{availableContacts.length === 0 &&
								/^\d{9}$/.test(contactSearch) && (
									<Button
										variant="ghost"
										onClick={async () => {
											const char = characters.find(
												(c) => c.phoneNumber === contactSearch.trim(),
											);
											if (!char) {
												toast.error("Phone number not found!");
												return;
											}
											if (!activeSpeakerId) return;
											await addContacts({
												fromId: activeSpeakerId,
												toId: char.id,
											});
											setContactSearch("");
											toast.success(
												`Successfully added ${char.name} as a contact`,
											);
										}}
										className="w-full h-12"
									>
										<PlusIcon size={"24px"} />
										Add new contact
									</Button>
								)}
							{availableContacts.map((char) => {
								const contact = contactMap.get(char.id);
								const isEditingThis = editingNicknameId === char.id;
								return (
									<div
										key={char.id}
										className="flex items-center gap-4 px-4 py-3 rounded-md hover:bg-white/5 transition-colors"
									>
										<Avatar className="size-10 shrink-0">
											<AvatarImage src={char.avatar ?? undefined} />
											<AvatarFallback className="text-[8px]">
												{char.name[0]}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											{isEditingThis ? (
												<input
													autoFocus
													value={editingNicknameValue}
													onChange={(e) =>
														setEditingNicknameValue(e.target.value)
													}
													onKeyDown={(e) => {
														if (e.key === "Enter") saveNickname(char.id);
														if (e.key === "Escape") setEditingNicknameId(null);
													}}
													onBlur={() => saveNickname(char.id)}
													placeholder={char.name}
													className="w-full bg-transparent border-b border-white/20 text-md outline-none pb-0.5"
												/>
											) : (
												<p className="text-md truncate">
													{contact?.nickname ?? char.name}
													{contact?.nickname && (
														<span className="ml-1.5 text-xs text-muted-foreground">
															({char.name})
														</span>
													)}
												</p>
											)}
											<p className="text-sm text-muted-foreground truncate">
												{char.phoneNumber}
											</p>
										</div>
										<button
											onClick={() => {
												setEditingNicknameId(char.id);
												setEditingNicknameValue(contact?.nickname ?? "");
											}}
											className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
											title="Edit nickname"
										>
											<Pencil className="w-3.5 h-3.5" />
										</button>
									</div>
								);
							})}
							{availableContacts.length === 0 && (
								<div className="w-full text-sm text-muted-foreground text-center flex-1 absolute top-1/2 left-1/2 -translate-1/2">
									No characters with phone numbers available.
								</div>
							)}
						</ScrollArea>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={showNewChat} onOpenChange={handleCreateDialogOpenChange}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Start Conversation</DialogTitle>
						<DialogDescription>
							{activeSpeaker
								? `Pick contacts for ${activeSpeaker.name}. One selection starts a direct chat; two or more creates a group.`
								: "Pick contacts to start chatting."}
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="rounded-xl border border-white/10 bg-white/5 p-3">
							<p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
								Mode
							</p>
							<div className="mt-2 flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium">{createActionLabel}</p>
									<p className="text-xs text-muted-foreground">
										{createActionDescription}
									</p>
								</div>
								<div className="rounded-full border border-white/10 bg-background/70 px-3 py-1 text-xs font-medium">
									{selectedCreateIds.length} selected
								</div>
							</div>
						</div>
						<Input
							placeholder="Search contacts..."
							value={createSearch}
							onChange={(e) => setCreateSearch(e.target.value)}
							className="h-10"
						/>
						{selectedCreateCharacters.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{selectedCreateCharacters.map((char) => (
									<button
										key={char.id}
										onClick={() => handleToggleCreateSelection(char.id)}
										className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs transition-colors hover:bg-white/10"
									>
										<span>{nicknameMap.get(char.id) ?? char.name}</span>
										<X className="w-3 h-3" />
									</button>
								))}
							</div>
						)}
						{selectedCreateIds.length > 1 && (
							<Input
								placeholder="Group name (optional)"
								value={newGroupName}
								onChange={(e) => setNewGroupName(e.target.value)}
							/>
						)}
						<ScrollArea className="max-h-72 rounded-xl border border-white/10 bg-background/40 p-1">
							<div className="flex flex-col gap-1">
								{createCandidates.map((char) => {
									const isSelected = selectedCreateIds.includes(char.id);
									const existingChatId = directChatMap.get(char.id);
									return (
										<button
											key={char.id}
											onClick={() => handleToggleCreateSelection(char.id)}
											className={cn(
												"flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
												isSelected
													? "border-primary/40 bg-primary/10"
													: "border-transparent hover:border-white/10 hover:bg-white/5",
											)}
										>
											<Avatar className="size-10 shrink-0">
												<AvatarImage src={char.avatar ?? undefined} />
												<AvatarFallback>{char.name[0]}</AvatarFallback>
											</Avatar>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium">
													{nicknameMap.get(char.id) ?? char.name}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													{existingChatId
														? (getLastMessagePreview(existingChatId) ??
															"Open existing direct chat")
														: "Start a new direct chat"}
												</p>
											</div>
											<div
												className={cn(
													"flex size-6 items-center justify-center rounded-full border transition-colors",
													isSelected
														? "border-primary bg-primary text-primary-foreground"
														: "border-white/15 bg-background/70 text-transparent",
												)}
											>
												<Check className="w-3.5 h-3.5" />
											</div>
										</button>
									);
								})}
								{createCandidates.length === 0 && (
									<div className="px-4 py-10 text-center text-sm text-muted-foreground">
										No contacts match that search.
									</div>
								)}
							</div>
						</ScrollArea>
					</div>
					<DialogFooter>
						<Button
							onClick={handleCreateConversation}
							disabled={selectedCreateIds.length === 0}
							className="w-full sm:w-auto"
						>
							{createActionLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<MembersDialog
				open={showMembers}
				onOpenChange={setShowMembers}
				members={managedGroupMembers}
				characters={characters}
				activeSpeakerId={activeSpeakerId}
				onRemoveMember={(characterId) =>
					managedGroupChatId &&
					removeChatMember({ chatId: managedGroupChatId, characterId })
				}
			/>
			<RenameDialog
				open={showRename}
				onOpenChange={setShowRename}
				initialName={renameInitial}
				onRename={(name) =>
					managedGroupChatId && renameChat({ chatId: managedGroupChatId, name })
				}
			/>
			<AddMembersDialog
				open={showAddMembers}
				onOpenChange={setShowAddMembers}
				characters={contactCharacters}
				existingMemberIds={managedGroupMembers.map((m) => m.characterId)}
				excludeId={activeSpeakerId}
				onAdd={(characterIds) =>
					managedGroupChatId &&
					addChatMembers({ chatId: managedGroupChatId, characterIds })
				}
			/>
			<ChangeCoverDialog
				open={showChangeCover}
				onOpenChange={setShowChangeCover}
				currentCover={managedGroupChat?.cover ?? null}
				onSave={(cover) =>
					managedGroupChatId &&
					activeSpeakerId &&
					updateChatCover({
						chatId: managedGroupChatId,
						cover,
						characterId: activeSpeakerId,
					})
				}
			/>
		</div>
	);
}
