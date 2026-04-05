import type { Session } from "@supabase/supabase-js";
import { getVersion } from "@tauri-apps/api/app";
import {
	Cloud,
	CloudOff,
	Layers,
	Link,
	Loader2,
	Network,
	Settings,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import { Separator } from "../ui/separator";
import { useSidebar } from "../ui/sidebar";
import CharacterTab from "./CharacterTab";
import GroupsTab from "./GroupsTab";
import LoginModal from "./LoginModal";
import NetworkTab from "./NetworkTab";
import RelationshipTypesTab from "./RelationshipTypesTab";
import SettingsTab from "./SettingsTab";
import ThemeToggle from "./ThemeToggle";

export default function AppSidebar() {
	const { state, toggleSidebar } = useSidebar();
	const setViewMode = useGraphStore((state) => state.setViewMode);
	const [loginModalOpen, setLoginModalOpen] = useState(false);
	const isSyncing = useGraphStore((state) => state.isSyncing);
	const [session, setSession] = useState<Session | null>(null);

	const [version, setVersion] = useState<string>("");
	const profile = useChatStore((state) => state.profile);

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
	//w-80 h-full *:bg-background border-r border-white/10 relative flex flex-col items-center border-bottom
	return (
		<Sidebar variant="inset" collapsible="icon" className="pt-0 z-150">
			<Tabs
				defaultValue="characters"
				orientation="vertical"
				className="h-full flex-row gap-0"
			>
				<div className="flex flex-col justify-center h-full border-r border-sidebar-border bg-sidebar shrink-0 w-(--sidebar-width-icon)">
					<TabsList className="flex flex-col justify-center bg-transparent border-none gap-4 py-2">
						<TabsTrigger
							title="Characters"
							value="characters"
							onClick={() => setViewMode("character")}
							className="justify-center"
						>
							<Users className="w-4 h-4" />
						</TabsTrigger>
						<TabsTrigger
							title="Network Graph"
							value="network"
							onClick={() => setViewMode("network")}
							className="justify-center"
						>
							<Network className="w-4 h-4" />
						</TabsTrigger>
						<TabsTrigger
							title="Groups"
							value="groups"
							onClick={() => setViewMode("network")}
							className="justify-center"
						>
							<Layers className="w-4 h-4" />
						</TabsTrigger>
						<TabsTrigger
							title="Relationship Types"
							value="types"
							onClick={() => setViewMode("character")}
							className="justify-center"
						>
							<Link className="w-4 h-4" />
						</TabsTrigger>
						<TabsTrigger
							title="Settings"
							value="settings"
							onClick={() => setViewMode("character")}
							className="justify-center"
						>
							<Settings className="w-4 h-4" />
						</TabsTrigger>
					</TabsList>
				</div>

				<div className="flex flex-col flex-1 min-w-0 overflow-hidden group-data-[state=collapsed]:hidden">
					<SidebarHeader className="p-2 py-4 gap-4">
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
										"flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest transition-all ",
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
					<SidebarContent>
						<SidebarGroup className="pt-0 pr-0">
							<TabsContent value="characters">
								<CharacterTab />
							</TabsContent>

							<TabsContent value="network">
								<NetworkTab />
							</TabsContent>

							<TabsContent value="groups">
								<GroupsTab />
							</TabsContent>

							<TabsContent value="types">
								<RelationshipTypesTab />
							</TabsContent>

							<TabsContent className="h-full" value="settings">
								<SettingsTab session={session} />
							</TabsContent>
						</SidebarGroup>
					</SidebarContent>
				</div>

				<LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />

				<div
					onClick={toggleSidebar}
					className={cn(
						"absolute inset-y-0 right-0 w-2 z-99 cursor-pointer group/trigger",
						"flex items-center justify-center transition-all",
					)}
				>
					{/* This is the visual line that glows on hover */}
					<div
						className={cn(
							"h-full w-[2px] transition-colors duration-200",
							"group-hover/trigger:bg-primary/50", // Glows with your theme's primary color
							"group-active/trigger:bg-primary", // Brightens when clicked
						)}
					/>

					{/* Optional: Add a tiny "chevron" or hint that appears only on hover */}
					<div className="absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover/trigger:opacity-100 transition-opacity">
						<div
							className={cn(
								"w-1 h-8 rounded-full bg-primary/20",
								state === "collapsed" ? "translate-x-1" : "-translate-x-2",
							)}
						/>
					</div>
				</div>
			</Tabs>
		</Sidebar>
	);
}
