import { Plus, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import type { Chat } from "@/store/useChatStore";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";

export default function ChatTab() {
	const profile = useChatStore((s) => s.profile);
	const chats = useChatStore((s) => s.chats);
	const activeChatId = useChatStore((s) => s.activeChatId);
	const pendingCharacterId = useChatStore((s) => s.pendingCharacterId);
	const setActiveChatId = useChatStore((s) => s.setActiveChatId);
	const setPendingCharacterId = useChatStore((s) => s.setPendingCharacterId);
	const fetchChats = useChatStore((s) => s.fetchChats);
	const fetchLatestMessages = useChatStore((s) => s.fetchLatestMessages);
	const createChat = useChatStore((s) => s.createChat);
	const chatMembers = useChatStore((s) => s.chatMembers);
	const fetchChatMembers = useChatStore((s) => s.fetchChatMembers);
	const activeSpeakerId = useChatStore((s) => s.activeSpeakerId);
	const setActiveSpeakerId = useChatStore((s) => s.setActiveSpeakerId);
	const allMessages = useChatStore((s) => s.messages);

	const characters = useGraphStore((s) => s.characters);
	const activeChar = characters.find((c) => c.id === activeSpeakerId);

	// Default speaker to first character if not set
	useEffect(() => {
		if (!activeSpeakerId && characters.length > 0) {
			setActiveSpeakerId(characters[0].id);
		}
	}, [activeSpeakerId, characters, setActiveSpeakerId]);

	const [search, setSearch] = useState("");
	const [showNewGroup, setShowNewGroup] = useState(false);
	const [newGroupName, setNewGroupName] = useState("");
	const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
	const [charSearch, setCharSearch] = useState("");

	const isAnon =
		!profile?.role || (profile.role !== "dm" && profile.role !== "player");

	// Fetch members for chats that haven't loaded them yet
	useEffect(() => {
		for (const chat of chats) {
			if (!chatMembers[chat.id]) {
				fetchChatMembers(chat.id);
			}
		}
	}, [chats, chatMembers, fetchChatMembers]);

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
			const members = chatMembers[chat.id] || [];
			const isMember = members.some((m) => m.characterId === activeSpeakerId);
			if (!isMember) continue;
			for (const m of members) {
				map.set(m.characterId, chat.id);
			}
		}
		return map;
	}, [chats, chatMembers, activeSpeakerId]);

	const groupChats = useMemo(() => chats.filter((c) => c.isGroup), [chats]);

	const filteredCharacters = useMemo(() => {
		// Build a map of characterId -> lastMessageAt from their direct chat
		const lastMessageMap = new Map<string, string>();
		for (const chat of chats) {
			if (chat.isGroup || !chat.lastMessageAt) continue;
			const members = chatMembers[chat.id] || [];
			for (const m of members) {
				if (m.characterId === activeSpeakerId) continue;
				const existing = lastMessageMap.get(m.characterId);
				if (!existing || chat.lastMessageAt > existing) {
					lastMessageMap.set(m.characterId, chat.lastMessageAt);
				}
			}
		}

		const sorted = [...characters].sort((a, b) => {
			const aTime = lastMessageMap.get(a.id);
			const bTime = lastMessageMap.get(b.id);
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
	}, [characters, search, chats, chatMembers, activeSpeakerId]);

	const filteredGroups = useMemo(() => {
		if (!search) return groupChats;
		const q = search.toLowerCase();
		return groupChats.filter((c) => {
			if (c.name?.toLowerCase().includes(q)) return true;
			const members = chatMembers[c.id] || [];
			return members.some((m) => {
				const char = characters.find((ch) => ch.id === m.characterId);
				return char?.name.toLowerCase().includes(q);
			});
		});
	}, [groupChats, search, chatMembers, characters]);

	const getGroupDisplayName = (chat: Chat) => {
		if (chat.name) return chat.name;
		const members = chatMembers[chat.id] || [];
		const names = members
			.map((m) => characters.find((c) => c.id === m.characterId)?.name)
			.filter(Boolean);
		return names.join(", ") || "Group chat";
	};

	const getLastMessagePreview = (chatId: string) => {
		const msgs = allMessages[chatId];
		if (!msgs || msgs.length === 0) return null;
		const last = msgs[msgs.length - 1];
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

	const isChatUnread = (chatId: string) => {
		if (!activeSpeakerId) return false;
		const members = chatMembers[chatId] || [];
		const me = members.find((m) => m.characterId === activeSpeakerId);
		if (!me) return false;

		const msgs = allMessages[chatId] || [];
		if (msgs.length === 0) return false;

		const lastMsg = msgs[msgs.length - 1];
		if (lastMsg.characterId === activeSpeakerId) return false;

		if (!me.lastReadAt) return true;
		return new Date(lastMsg.created_at) > new Date(me.lastReadAt);
	};

	const handleCharacterClick = (charId: string) => {
		const existingChatId = directChatMap.get(charId);
		if (existingChatId) {
			setActiveChatId(existingChatId);
		} else {
			// No chat yet — set pending, chat will be created on first message
			setPendingCharacterId(charId);
		}
	};

	const handleCreateGroup = async () => {
		if (selectedCharIds.length < 2) return;
		const chatId = await createChat(
			newGroupName || null,
			true,
			selectedCharIds,
		);
		if (chatId) {
			setActiveChatId(chatId);
		}
		setShowNewGroup(false);
		setNewGroupName("");
		setSelectedCharIds([]);
		setCharSearch("");
	};

	const newGroupCharacters = useMemo(() => {
		if (!charSearch) return characters;
		const q = charSearch.toLowerCase();
		return characters.filter((c) => c.name.toLowerCase().includes(q));
	}, [characters, charSearch]);

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
				<Button
					onClick={() => setShowNewGroup(true)}
					variant="ghost"
					title="New group chat"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>

			{/* Character selector */}
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
					items={characters.filter((c) => c.ownerId === profile.userId)}
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

			{/* Search */}
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

			{/* Group chats section */}

			<div className="mb-2">
				<p className="text-[10px] font-mono uppercase tracking-widest opacity-30 px-1 mb-1">
					Group Chats ({groupChats.length})
				</p>
				{filteredGroups.map((chat) => (
					<div
						key={chat.id}
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
						<div className="size-8 mr-3 rounded-full bg-white/10 flex items-center justify-center shrink-0">
							<Users className="w-3.5 h-3.5 text-muted-foreground" />
						</div>
						<div className="flex-1 min-w-0">
							<h3 className="text-sm font-medium truncate">
								{getGroupDisplayName(chat)}
							</h3>
							<p className="text-[10px] opacity-30 truncate">
								{getLastMessagePreview(chat.id) ??
									(chat.lastMessageAt
										? new Date(chat.lastMessageAt).toLocaleDateString()
										: "No messages yet")}
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

			{/* Characters (direct messages) */}
			<div>
				<p className="text-[10px] font-mono uppercase tracking-widest opacity-30 px-1 mb-1">
					Friends ({filteredCharacters.length})
				</p>
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
								<h3 className="text-sm font-medium truncate">{char.name}</h3>
								<p className="text-[10px] opacity-30 truncate">
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
							<div className="max-h-48 overflow-y-auto space-y-1">
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
							</div>
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
		</div>
	);
}
