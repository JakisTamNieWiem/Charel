import type { Session } from "@supabase/supabase-js";
import { getVersion } from "@tauri-apps/api/app";
import { Cloud, Layers, Link, Network, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
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
	// const { state, open, setOpen, toggleSidebar } = useSidebar();
	const setViewMode = useGraphStore((state) => state.setViewMode);
	const [loginModalOpen, setLoginModalOpen] = useState(false);
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
				<Badge className="font-mono tracking-normal" variant={"default"}>
					DM
				</Badge>
			);
		} else if (profile?.role === "player") {
			return (
				<Badge className="font-mono tracking-normal" variant={"outline"}>
					Player
				</Badge>
			);
		} else
			return (
				<Badge className="font-mono tracking-normal" variant={"destructive"}>
					Anon
				</Badge>
			);
	})();
	//w-80 h-full *:bg-background border-r border-white/10 relative flex flex-col items-center border-bottom
	return (
		<Tabs defaultValue="characters">
			<Sidebar className="w-80 relative">
				<SidebarHeader className="p-3">
					<div className="w-full flex justify-between items-center">
						<div className="flex gap-2">
							<ThemeToggle />
							<h1
								title={version}
								className="text-2xl font-bold tracking-tighter flex items-center gap-2 serif"
							>
								{displayName}
								{roleBadge}
							</h1>
						</div>
						{session ? (
							<div className="flex items-center justify-between">
								<Button
									variant="ghost"
									onClick={() => supabase.auth.signOut()}
									className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-emerald-400"
									title="Disconnect"
								>
									<Cloud className="w-3 h-3" /> Online
								</Button>
							</div>
						) : (
							<Button
								variant="ghost"
								className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-red-500"
								onClick={() => setLoginModalOpen(true)}
							>
								<Cloud className="w-3 h-3" /> Offline
							</Button>
						)}
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
				<div className="px-3 pt-2">
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
			</Sidebar>
		</Tabs>
	);
}
