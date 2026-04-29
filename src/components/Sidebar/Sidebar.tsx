import type { Session } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { getVersion } from "@tauri-apps/api/app";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { getSidebarItemForPath, sidebarNavItems } from "@/lib/app-navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import LoginModal from "./LoginModal";
import ThemeToggle from "./ThemeToggle";

export default function AppSidebar() {
	const navigate = useNavigate();
	const pathname = useLocation({
		select: (location) => location.pathname,
	});
	const activeItem = getSidebarItemForPath(pathname);
	const ActivePanel = activeItem.panel;
	const [loginModalOpen, setLoginModalOpen] = useState(false);
	const isSyncing = useGraphStore((state) => state.isSyncing);
	const [session, setSession] = useState<Session | null>(null);

	const [version, setVersion] = useState<string>("");

	const { data: profile } = useProfile();
	const { data: chats = [] } = useChats();
	const chatIds = useMemo(() => chats.map((c) => c.id), [chats]);
	const { data: latestMessages = {} } = useLatestMessages(chatIds);
	const activeSpeakerId = useChatStore((state) => state.activeSpeakerId);

	const characters = useGraphStore((state) => state.characters);
	const setNetworkMode = useGraphStore((state) => state.setNetworkMode);

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

	const displayName = (() => {
		if (profile?.displayName) {
			return profile.displayName;
		} else if (session?.user.email) {
			return (
				session.user.email?.split("@")[0][0].toUpperCase() +
				session.user.email?.split("@")[0].slice(1)
			);
		} else return "GUEST";
	})();

	const roleBadge = (() => {
		if (profile?.role === "dm") return "SYSTEM_ADMIN";
		if (profile?.role === "player") return "AUTHORIZED_USER";
		return "GUEST_ACCESS";
	})();

	return (
		<Sidebar
			variant="sidebar"
			collapsible="icon"
			className="pt-0 z-45 pl-0 border-r-0"
		>
			<div className="h-full flex flex-row bg-sidebar">
				<div className="flex flex-col h-full bg-card/50 border-r border-border shrink-0 w-(--sidebar-width-icon) z-20 shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
					<div className="flex flex-col items-center gap-4 py-6 flex-1">
						{sidebarNavItems.map((item) => (
							<button
								key={item.value}
								type="button"
								title={item.title}
								onClick={() => {
									if ("networkMode" in item) {
										setNetworkMode(item.networkMode);
									}
									void navigate({ to: item.to });
									contentRef.current?.scrollTo(0, 0);
								}}
								className={cn(
									"relative group flex items-center justify-center w-10 h-10 transition-all duration-500",
									activeItem.value === item.value
										? "text-primary"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<item.icon
									className={cn(
										"w-5 h-5 transition-all duration-500 relative z-10",
										activeItem.value === item.value &&
											"scale-110 drop-shadow-sm",
									)}
									strokeWidth={activeItem.value === item.value ? 2 : 1.5}
								/>
								{item.value === "chat" && hasUnread && (
									<span className="absolute top-2 right-2 flex h-2 w-2 z-20">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
										<span className="relative inline-flex rounded-full h-2 w-2 bg-destructive border-[1.5px] border-background" />
									</span>
								)}
							</button>
						))}
					</div>
					<div className="py-4 flex justify-center border-t border-border/50">
						<SidebarTrigger className="w-10 h-10 hover:bg-secondary/80 rounded-xl transition-colors" />
					</div>
				</div>

				<div className="flex flex-col flex-1 min-w-0 overflow-hidden group-data-[state=collapsed]:hidden bg-sidebar/30 relative z-10 shadow-[8px_0_24px_rgba(0,0,0,0.02)]">
					<SidebarHeader className="p-0 border-b border-border/40 bg-background/40 backdrop-blur-md">
						<div className="flex flex-col p-6 gap-6 relative overflow-hidden">
							<div className="flex justify-between items-start z-10">
								<div className="flex flex-col gap-1">
									<h1
										title={version}
										className="text-2xl font-black tracking-tighter uppercase text-foreground"
									>
										{displayName}
									</h1>
									<div className="flex items-center gap-2">
										<span className="inline-block w-1.5 h-1.5 bg-primary rounded-sm" />
										<span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
											{roleBadge}
										</span>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-between z-10 bg-secondary/30 rounded-lg p-2 border border-border/50">
								<Button
									variant="ghost"
									size="sm"
									disabled={isSyncing}
									className={cn(
										"flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest h-7 px-2",
										session
											? "text-primary hover:text-primary/80"
											: "text-destructive hover:text-destructive/80",
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

									{isSyncing ? "SYNCING" : session ? "CONNECTED" : "OFFLINE"}
								</Button>
								<div className="h-4 w-px bg-border/50 mx-1" />
								<ThemeToggle />
							</div>
						</div>
					</SidebarHeader>
					<SidebarContent ref={contentRef} className="px-3 pt-0 pb-4">
						<SidebarGroup className="p-0">
							<ActivePanel />
						</SidebarGroup>
					</SidebarContent>
				</div>

				<LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
			</div>
		</Sidebar>
	);
}
