import {
	Pencil,
	Plus,
	PlusIcon,
	Search,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	useAddContacts,
	useChats,
	useContacts,
	useCreateChat,
	useUpdateContactNickname,
} from "@/hooks/use-chats";
import { useLatestMessages } from "@/hooks/use-messages";
import { useUnreadChats } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import type { Chat, ChatMember } from "@/types/chat";
import {
	SidebarEmptyState,
	SidebarSection,
	SidebarTabHeader,
	SidebarTabRoot,
	sidebarInputClass,
	sidebarRowClass,
} from "./SidebarTabLayout";

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
	const { data: contacts = [] } = useContacts(activeSpeakerId ?? "");

	const characters = useGraphStore((s) => s.characters);
	const activeChar = characters.find((c) => c.id === activeSpeakerId);
	const contactIds = useMemo(
		() => new Set(contacts.map((contact) => contact.toId)),
		[contacts],
	);

	// toId → nickname (only entries that have one)
	const nicknameMap = useMemo(
		() =>
			new Map(
				contacts
					.filter((c) => c.nickname)
					.map((c) => [c.toId, c.nickname as string]),
			),
		[contacts],
	);

	// toId → full Contact record (for the dialog)
	const contactMap = useMemo(
		() => new Map(contacts.map((c) => [c.toId, c])),
		[contacts],
	);

	const [editingNicknameId, setEditingNicknameId] = useState<string | null>(
		null,
	);
	const [editingNicknameValue, setEditingNicknameValue] = useState("");

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

	// Default speaker to first character if not set
	useEffect(() => {
		if (!activeSpeakerId && characters.length > 0 && profile) {
			const mine = characters.filter((c) => c.ownerId === profile.userId);
			if (mine.length > 0) {
				setActiveSpeakerId(mine[0].id);
			}
		}
	}, [activeSpeakerId, characters, setActiveSpeakerId, profile]);

	const [search, setSearch] = useState("");
	const [showNewGroup, setShowNewGroup] = useState(false);
	const [showAddContact, setShowAddContact] = useState(false);
	const [newGroupName, setNewGroupName] = useState("");
	const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

	const [charSearch, setCharSearch] = useState("");
	const [contactSearch, setContactSearch] = useState("");

	const isAnon =
		!profile?.role || (profile.role !== "dm" && profile.role !== "player");

	// Clear active chat when switching speakers to avoid showing another character's messages
	useEffect(() => {
		if (!activeSpeakerId) return;
		setActiveChatId(null);
		setPendingCharacterId(null);
	}, [activeSpeakerId, setActiveChatId, setPendingCharacterId]);

	// Build a map: characterId -> existing 1:1 chatId
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

	const contactCharacters = useMemo(
		() =>
			characters.filter(
				(char) =>
					char.id !== activeSpeakerId &&
					!!char.phoneNumber?.trim() &&
					chats.some(
						(c) =>
							c.members.length > 0 &&
							c.members.every(
								(m) =>
									m.characterId === char.id ||
									m.characterId === activeSpeakerId,
							),
					),
			),
		[characters, activeSpeakerId, chats],
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
	const hasDirectChats = contactCharacters.length > 0;
	const hasGroupChats = groupChats.length > 0;

	const filteredCharacters = useMemo(() => {
		const sorted = [...contactCharacters].sort((a, b) => {
			const aChatId = directChatMap.get(a.id);
			const bChatId = directChatMap.get(b.id);
			const aChat = chats.find((c) => c.id === aChatId);
			const bChat = chats.find((c) => c.id === bChatId);

			const aTime = aChat?.lastMessageAt;
			const bTime = bChat?.lastMessageAt;

			// Characters with messages come first, sorted by newest
			if (aTime && bTime) return bTime.localeCompare(aTime);
			if (aTime) return -1;
			if (bTime) return 1;
			// Then alphabetical
			return a.name.localeCompare(b.name);
		});

		if (!search) return sorted;
		const q = search.toLowerCase();
		return sorted.filter((c) => c.name.toLowerCase().includes(q));
	}, [contactCharacters, search, chats, directChatMap]);

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
		if (last.content.startsWith("[img]")) return "📷 Image";
		if (
			/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?\S*)?/i.test(
				last.content,
			)
		)
			return "📷 Image";
		return last.content.length > 30
			? `${last.content.slice(0, 30)}...`
			: last.content;
	};

	const getGroupLastMessagePreview = (chatId: string) => {
		const last = latestMessages[chatId];
		if (!last) return null;
		const preview = getLastMessagePreview(chatId);
		if (!preview) return null;
		// System messages have no sender
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

	const handleCreateGroup = async () => {
		if (!activeSpeakerId || selectedCharIds.length < 2) return;
		const charactersToAdd = characters.filter((c) =>
			[activeSpeakerId, ...selectedCharIds].includes(c.id),
		);
		const chatId = await createChat({
			name: newGroupName || null,
			isGroup: true,
			characters: charactersToAdd,
		});
		if (chatId) {
			setActiveChatId(chatId);
		}
		setShowNewGroup(false);
		setNewGroupName("");
		setSelectedCharIds([]);
		setCharSearch("");
	};

	const newGroupCharacters = useMemo(() => {
		if (!charSearch) return contactCharacters;
		const q = charSearch.toLowerCase();
		return contactCharacters.filter((c) => c.name.toLowerCase().includes(q));
	}, [contactCharacters, charSearch]);

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

	if (isAnon) {
		return (
			<SidebarTabRoot>
				<SidebarTabHeader title="Chats" count={characters.length} />
				<SidebarEmptyState title="Chat unavailable">
					Log in as a player or DM to access chat.
				</SidebarEmptyState>
				<SidebarSection title="Characters" count={characters.length}>
					<div className="space-y-1">
						{characters.map((c) => (
							<div
								key={c.id}
								className={`${sidebarRowClass} flex items-center gap-2 px-2 py-1.5`}
							>
								<Avatar className="size-6">
									<AvatarImage src={c.avatar ?? undefined} />
									<AvatarFallback className="text-[8px]">
										{c.name[0]}
									</AvatarFallback>
								</Avatar>
								<span className="truncate text-xs font-medium">{c.name}</span>
							</div>
						))}
					</div>
				</SidebarSection>
			</SidebarTabRoot>
		);
	}

	return (
		<SidebarTabRoot>
			<SidebarTabHeader
				title="Chats"
				count={filteredGroups.length + filteredCharacters.length}
				action={
					<>
						<Button
							onClick={() => setShowAddContact(true)}
							variant="ghost"
							size="icon-sm"
							title="Add contact"
							disabled={!activeSpeakerId}
							className="hover:bg-(--sidebar-foreground)/8"
						>
							<UserPlus className="w-4 h-4" />
						</Button>
						<Button
							onClick={() => setShowNewGroup(true)}
							variant="ghost"
							size="icon-sm"
							title="New group chat"
							disabled={!activeSpeakerId}
							className="hover:bg-(--sidebar-foreground)/8"
						>
							<Plus className="w-4 h-4" />
						</Button>
					</>
				}
			/>

			<SidebarSection title="Speaking as" className="space-y-2">
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
						className={cn(sidebarInputClass, "h-9 w-full text-sm")}
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
			</SidebarSection>

			<SidebarSection className="space-y-2">
				<div className="relative">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
					<Input
						placeholder="Search..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className={cn(sidebarInputClass, "h-9 pl-7 text-sm")}
					/>
				</div>
			</SidebarSection>

			<SidebarSection title="Group Chats" count={groupChats.length}>
				<div className="space-y-1.5">
					{!search && !hasGroupChats && (
						<button
							type="button"
							onClick={() => setShowNewGroup(true)}
							disabled={!activeSpeakerId}
							className={cn(
								sidebarRowClass,
								"flex min-h-[3.25rem] w-full items-center gap-3 px-3 py-2.5 text-left text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45",
							)}
						>
							<div className="grid size-8 shrink-0 place-items-center rounded-full bg-(--sidebar-foreground)/5">
								<Plus className="size-3.5" />
							</div>
							<span className="truncate text-sm italic">
								Create a group chat...
							</span>
						</button>
					)}
					{filteredGroups.map((chat) => (
						<div
							key={chat.id}
							onClick={() => setActiveChatId(chat.id)}
							className={cn(
								sidebarRowClass,
								"group/chat flex cursor-pointer items-center px-3 py-2.5 relative",
								activeChatId === chat.id
									? [
											"border-(--sidebar-primary)/20 bg-(--sidebar-primary)/8",
											"shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)]",
										]
									: "shadow-none",
							)}
						>
							<div className="size-8 mr-3 rounded-full bg-(--sidebar-foreground)/8 flex items-center justify-center shrink-0 overflow-hidden border border-(--sidebar-foreground)/10">
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
								<p className="text-[0.625rem] text-muted-foreground truncate">
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
					))}
				</div>
			</SidebarSection>

			<SidebarSection title="Direct Chats" count={filteredCharacters.length}>
				<div className="space-y-1.5">
					{!search && !hasDirectChats && (
						<button
							type="button"
							onClick={() => setShowAddContact(true)}
							disabled={!activeSpeakerId}
							className={cn(
								sidebarRowClass,
								"flex min-h-[3.25rem] w-full items-center gap-3 px-3 py-2.5 text-left text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45",
							)}
						>
							<div className="grid size-10 shrink-0 place-items-center rounded-full bg-(--sidebar-foreground)/5">
								<UserPlus className="size-3.5" />
							</div>
							<span className="truncate text-sm italic">
								Start a direct chat...
							</span>
						</button>
					)}
					{filteredCharacters.map((char) => {
						const existingChatId = directChatMap.get(char.id);
						const isActive = existingChatId
							? activeChatId === existingChatId
							: pendingCharacterId === char.id;

						return (
							<div
								key={char.id}
								onClick={() => handleCharacterClick(char.id)}
								className={cn(
									sidebarRowClass,
									"flex cursor-pointer items-center px-3 py-2.5 relative",
									isActive
										? [
												"border-(--sidebar-primary)/20 bg-(--sidebar-primary)/8",
												"shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)]",
											]
										: "shadow-none",
								)}
							>
								<Avatar className="size-10 mr-3 shrink-0">
									<AvatarImage src={char.avatar ?? undefined} />
									<AvatarFallback>{char.name[0]}</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<h3 className="text-sm font-semibold truncate">
										{nicknameMap.get(char.id) ?? char.name}
									</h3>
									<p className="text-[0.625rem] text-muted-foreground truncate">
										{existingChatId
											? (getLastMessagePreview(existingChatId) ??
												"No messages yet")
											: "No messages yet"}
									</p>
								</div>
								{existingChatId && isChatUnread(existingChatId) && (
									<span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2 w-2">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
										<span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
									</span>
								)}
							</div>
						);
					})}
				</div>
			</SidebarSection>

			{/* Add Contact Dialog */}
			<Dialog
				open={showAddContact}
				onOpenChange={(open) => {
					setShowAddContact(open);
					if (!open) {
						setContactSearch("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Contacts</DialogTitle>
					</DialogHeader>
					<div className="space-y-6 min-h-128! flex flex-col">
						<Input
							placeholder="Search characters or phone numbers..."
							value={contactSearch}
							onChange={(e) => setContactSearch(e.target.value)}
							className="h-12 text-md"
						/>
						{activeChar && (
							<div className="flex items-center gap-4 rounded-md border border-white/10 bg-white/5 px-4 py-3">
								<Avatar className="size-10 shrink-0">
									<AvatarImage src={activeChar.avatar ?? undefined} />
									<AvatarFallback className="text-[8px]">
										{activeChar.name[0]}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-md">{activeChar.name}</p>
										<span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[0.5625rem] font-mono uppercase tracking-[0.12em] text-muted-foreground">
											You
										</span>
									</div>
									<p className="truncate text-sm text-muted-foreground">
										{activeChar.phoneNumber?.trim() || "No phone number"}
									</p>
								</div>
							</div>
						)}
						<ScrollArea className="h-full max-h-96 overflow-y-auto space-y-1 bg-background overflow-visible rounded-md p-1">
							{availableContacts.length === 0 &&
								/^\d{9}$/.test(contactSearch) && (
									<Button
										variant={"ghost"}
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

			{/* New Group Chat Dialog */}
			<Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New Group Chat</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<Input
							placeholder="Group name (optional)"
							value={newGroupName}
							onChange={(e) => setNewGroupName(e.target.value)}
							className="text-sm"
						/>
						<div>
							<label className="text-xs font-mono uppercase tracking-widest opacity-50 mb-2 block">
								Add Characters
							</label>
							<div className="relative mb-2">
								<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
								<Input
									placeholder="Search characters..."
									value={charSearch}
									onChange={(e) => setCharSearch(e.target.value)}
									className="h-7 pl-7 text-xs"
								/>
							</div>
							{selectedCharIds.length > 0 && (
								<div className="flex flex-wrap gap-1 mb-2">
									{selectedCharIds.map((id) => {
										const char = characters.find((c) => c.id === id);
										if (!char) return null;
										return (
											<span
												key={id}
												className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs"
											>
												{char.name}
												<X
													className="w-3 h-3 cursor-pointer hover:text-red-400"
													onClick={() =>
														setSelectedCharIds((prev) =>
															prev.filter((cid) => cid !== id),
														)
													}
												/>
											</span>
										);
									})}
								</div>
							)}
							<ScrollArea className="max-h-48 overflow-y-auto space-y-1">
								{newGroupCharacters
									.filter((c) => !selectedCharIds.includes(c.id))
									.map((char) => (
										<div
											key={char.id}
											onClick={() =>
												setSelectedCharIds((prev) => [...prev, char.id])
											}
											className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-white/5 transition-colors"
										>
											<Avatar className="size-6">
												<AvatarImage src={char.avatar ?? undefined} />
												<AvatarFallback className="text-[8px]">
													{char.name[0]}
												</AvatarFallback>
											</Avatar>
											<span className="text-sm truncate">{char.name}</span>
										</div>
									))}
							</ScrollArea>
						</div>
						<Button
							onClick={handleCreateGroup}
							disabled={selectedCharIds.length < 2}
							className="w-full"
						>
							Create Group Chat
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</SidebarTabRoot>
	);
}
