import type { Session } from "@supabase/supabase-js";
import { getVersion } from "@tauri-apps/api/app";
import { Cloud, Layers, Link, Network, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";
import { Separator } from "../ui/separator";
import CharacterTab from "./CharacterTab";
import GroupsTab from "./GroupsTab";
import LoginModal from "./LoginModal";
import NetworkTab from "./NetworkTab";
import RelationshipTypesTab from "./RelationshipTypesTab";
import SettingsTab from "./SettingsTab";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar() {
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

	return (
		<div className="w-80 h-full *:bg-background border-r border-white/10 relative flex flex-col items-center border-bottom">
			<div className="w-full p-4 self-start flex items-center justify-between">
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
			</div>
			<LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
			<Tabs defaultValue="characters" className="flex flex-col size-full pb-16">
				<div className="px-3 flex w-full justify-between">
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
				<div className="px-3 pt-2">
					<Separator />
				</div>
				<TabsContent className="overflow-hidden" value="characters">
					<CharacterTab />
				</TabsContent>
				<TabsContent value="network">
					<NetworkTab />
				</TabsContent>
				<TabsContent className=" overflow-hidden" value="groups">
					<GroupsTab />
				</TabsContent>
				<TabsContent className="overflow-hidden" value="types">
					<RelationshipTypesTab />
				</TabsContent>
				<TabsContent className="h-full" value="settings">
					<SettingsTab session={session} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
