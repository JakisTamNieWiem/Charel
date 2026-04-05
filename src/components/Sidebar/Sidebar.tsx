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
import { Badge } from "@/components/ui/badge";
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
				<Badge className="font-mono tracking-normal mt-1" variant={"default"}>
					DM
				</Badge>
			);
		} else if (profile?.role === "player") {
			return (
				<Badge className="font-mono tracking-normal mt-1" variant={"outline"}>
					Player
				</Badge>
			);
		} else
			return (
				<Badge
					className="font-mono tracking-normal mt-1"
					variant={"destructive"}
				>
					Anon
				</Badge>
			);
	})();
	//w-80 h-full *:bg-background border-r border-white/10 relative flex flex-col items-center border-bottom
	return (
		<Sidebar variant="inset" className="pt-0 z-150">
			<Tabs defaultValue="characters" className="h-full">
				<SidebarHeader className="p-2 py-4 gap-4">
					<div className="w-full flex justify-between items-center">
						<div className="flex gap-2 items-center">
							<ThemeToggle />
							<h1
								title={version}
								className="text-3xl font-bold leading-none tracking-tighter serif self-end"
							>
								{displayName}
							</h1>
							{roleBadge}
						</div>
						<Button
							variant="ghost"
							disabled={isSyncing}
							className={cn(
								"flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest transition-all ",
								session ? "text-emerald-400" : "text-red-500",
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
						<LoginModal
							open={loginModalOpen}
							onOpenChange={setLoginModalOpen}
						/>
					</div>

					<div className="flex w-full justify-between">
						<TabsList className="w-full shrink-0">
							<TabsTrigger
								title="Characters"
								value="characters"
								onClick={() => setViewMode("character")}
							>
								<Users className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								title="Network Graph"
								value="network"
								onClick={() => setViewMode("network")}
							>
								<Network className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								title="Groups"
								value="groups"
								onClick={() => setViewMode("network")}
							>
								<Layers className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								title="Relationship Types"
								value="types"
								onClick={() => setViewMode("character")}
							>
								<Link className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								title="Settings"
								value="settings"
								onClick={() => setViewMode("character")}
							>
								<Settings className="w-4 h-4" />
							</TabsTrigger>
						</TabsList>
					</div>
				</SidebarHeader>
				<div className="px-3">
					<Separator />
				</div>
				<SidebarContent>
					<SidebarGroup className="pt-0">
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
				<div
					onClick={toggleSidebar}
					className={cn(
						"absolute inset-y-0 -right-2 w-4 z-50 cursor-pointer group/trigger",
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
