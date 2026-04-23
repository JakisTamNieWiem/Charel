import type { Session } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { getVersion } from "@tauri-apps/api/app";
import {
	Cloud,
	CloudOff,
	Layers,
	Link,
	Loader2,
	MessageCircle,
	Network,
	Settings,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useChats } from "@/hooks/use-chats";
import { useLatestMessages } from "@/hooks/use-messages";
import { useProfile } from "@/hooks/use-profile";
import {
	type AppPage,
	defaultSidebarTabByPage,
	pagePaths,
	pathnameToPage,
	type SidebarTab,
	sidebarTabToPage,
} from "@/lib/app-navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import CharacterTab from "./CharacterTab";
import ChatTab from "./ChatTab";
import GroupsTab from "./GroupsTab";
import LoginModal from "./LoginModal";
import NetworkTab from "./NetworkTab";
import RelationshipTypesTab from "./RelationshipTypesTab";
import SettingsTab from "./SettingsTab";
import ThemeToggle from "./ThemeToggle";

const navItems: {
	value: SidebarTab;
	icon: React.ElementType;
	title: string;
	page: AppPage;
}[] = [
	{
		value: "characters",
		icon: Users,
		title: "Characters",
		page: "characters",
	},
	{
		value: "network",
		icon: Network,
		title: "Network Graph",
		page: "network",
	},
	{ value: "groups", icon: Layers, title: "Groups", page: "network" },
	{
		value: "types",
		icon: Link,
		title: "Relationship Types",
		page: "characters",
	},
	{ value: "chat", icon: MessageCircle, title: "Chat", page: "chat" },
	{
		value: "settings",
		icon: Settings,
		title: "Settings",
		page: "characters",
	},
];

export default function AppSidebar() {
	const navigate = useNavigate();
	const pathname = useLocation({
		select: (location) => location.pathname,
	});
	const currentPage = pathnameToPage(pathname);
	const [loginModalOpen, setLoginModalOpen] = useState(false);
	const isSyncing = useGraphStore((state) => state.isSyncing);
	const [session, setSession] = useState<Session | null>(null);
	const [activeTab, setActiveTab] = useState<SidebarTab>(
		defaultSidebarTabByPage[currentPage],
	);

	const [version, setVersion] = useState<string>("");

	const { data: profile } = useProfile();
	const { data: chats = [] } = useChats();
	const chatIds = useMemo(() => chats.map((c) => c.id), [chats]);
	const { data: latestMessages = {} } = useLatestMessages(chatIds);
	const activeSpeakerId = useChatStore((state) => state.activeSpeakerId);

	const characters = useGraphStore((state) => state.characters);

	const hasUnread = useMemo(() => {
		if (!activeSpeakerId || chats.length === 0) return false;
		return chats.some((chat) => {
			const members = chat.members || [];
			const me = members.find((m) => m.characterId === activeSpeakerId);
			if (!me) return false;
			if (!chat.isGroup) {
				const other = members.find((m) => m.characterId !== activeSpeakerId);
				if (!other) return false;
				const otherCharacter = characters.find(
					(c) => c.id === other.characterId,
				);
				if (!otherCharacter?.phoneNumber?.trim()) return false;
			}

			const lastMsg = latestMessages[chat.id];
			if (!lastMsg) return false;
			if (lastMsg.characterId === activeSpeakerId) return false;

			if (!me.lastReadAt) return true;
			return new Date(lastMsg.created_at) > new Date(me.lastReadAt);
		});
	}, [activeSpeakerId, chats, characters, latestMessages]);

	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data }) => setSession(data.session));
		supabase.auth.onAuthStateChange((_e, s) => setSession(s));
		getVersion().then((v) => setVersion(`Version: ${v}`));
	}, []);

	useEffect(() => {
		if (sidebarTabToPage[activeTab] !== currentPage) {
			setActiveTab(defaultSidebarTabByPage[currentPage]);
		}
	}, [activeTab, currentPage]);

	const displayName = (() => {
		if (profile?.displayName) {
			return profile.displayName;
		} else if (session?.user.email) {
			return (
				session.user.email?.split("@")[0][0].toUpperCase() +
				session.user.email?.split("@")[0].slice(1)
			);
		} else return "Charel";
	})();

	const roleBadge = (() => {
		if (profile?.role === "dm") {
			return (
				<span className="font-mono tracking-normal mt-1 text-sm text-muted-foreground">
					DM
				</span>
			);
		} else if (profile?.role === "player") {
			return (
				<span className="font-mono tracking-normal mt-1 text-sm text-muted-foreground">
					Player
				</span>
			);
		} else
			return (
				<span className="font-mono tracking-normal mt-1 text-sm text-muted-foreground">
					Anon
				</span>
			);
	})();

	return (
		<Sidebar variant="inset" collapsible="icon" className="pt-0 z-45 pl-0">
			<div className="h-full flex flex-row gap-0">
				<div className="flex flex-col h-full border-r border-sidebar-border bg-sidebar shrink-0 w-(--sidebar-width-icon)">
					<div className="flex flex-col justify-center gap-2 py-2 px-1 flex-1">
						{navItems.map(({ value, icon: Icon, title, page }) => (
							<Button
								key={value}
								variant="ghost"
								title={title}
								onClick={() => {
									setActiveTab(value);
									void navigate({ to: pagePaths[page] });
									contentRef.current?.scrollTo(0, 0);
								}}
								className={cn(
									"inline-flex items-center justify-center rounded-md px-2 py-1 transition-all [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 relative",
									activeTab === value
										? "text-foreground bg-background shadow-sm dark:bg-input/30"
										: "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
								)}
							>
								<Icon className="w-4 h-4" />
								{value === "chat" && hasUnread && (
									<span className="absolute top-1 right-1 flex h-2 w-2">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
										<span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
									</span>
								)}
							</Button>
						))}
					</div>
					<div className="py-2 px-1">
						<SidebarTrigger
							variant="ghost"
							className="w-full inline-flex items-center justify-center rounded-md px-2 py-1 text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground cursor-pointer"
						/>
					</div>
				</div>

				<div className="flex flex-col flex-1 min-w-0 overflow-hidden group-data-[state=collapsed]:hidden">
					<SidebarHeader className="p-2 pb-4 pt-8 gap-4">
						<div className="w-full flex justify-between items-center">
							<div className="flex gap-2 items-center px-2">
								<div className="flex flex-col">
									<h1
										title={version}
										className="text-3xl font-black leading-none tracking-tighter serif self-end"
									>
										{displayName}
									</h1>
									{roleBadge}
								</div>
							</div>
							<div className="flex flex-col">
								<Button
									variant="ghost"
									disabled={isSyncing}
									className={cn(
										"flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest transition-all z-150",
										session
											? "text-emerald-400 dark:text-emerald-600"
											: "text-red-500 dark:text-red-400",
									)}
									onClick={() =>
										session ? supabase.auth.signOut() : setLoginModalOpen(true)
									}
								>
									{isSyncing ? (
										<Loader2 className="w-3 h-3 animate-spin" />
									) : session ? (
										<Cloud className="w-3 h-3" />
									) : (
										<CloudOff className="w-3 h-3" />
									)}

									{isSyncing ? "Syncing..." : session ? "Online" : "Offline"}
								</Button>
								<ThemeToggle />
							</div>
						</div>
					</SidebarHeader>
					<div className="px-3">
						<Separator />
					</div>
					<SidebarContent ref={contentRef}>
						<SidebarGroup className="pt-0 pr-0">
							{activeTab === "characters" && <CharacterTab />}
							{activeTab === "network" && <NetworkTab />}
							{activeTab === "groups" && <GroupsTab />}
							{activeTab === "types" && <RelationshipTypesTab />}
							{activeTab === "chat" && <ChatTab />}
							{activeTab === "settings" && <SettingsTab />}
						</SidebarGroup>
					</SidebarContent>
				</div>

				<LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
			</div>
		</Sidebar>
	);
}
