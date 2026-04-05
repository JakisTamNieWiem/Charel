import { useEffect, useState } from "react";
import CharacterGraph from "@/components/CharacterGraph";
import ChatWindow from "@/components/chat/ChatWindow";
import NetworkGraph from "@/components/NetworkGraph";
import AppSidebar from "@/components/Sidebar/Sidebar";
import TypeModal from "@/components/TypeModal";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, Relationship, RelationshipType } from "@/types/types";
import "./styles.css";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { Circle, LayoutGrid } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadFromDisk, saveToDisk } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { checkForUpdates } from "@/lib/updater"; // <--- Add this import
import type {
	Message,
	Profile,
	RealtimeMessageDeletePayload,
	RealtimeMessagePayload,
} from "@/types/chat";
import LoadingScreen from "./components/LoadingScreen";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { useChatStore } from "./store/useChatStore";

function App() {
	// Supabase
	const [session, setSession] = useState<Session | null>(null);
	const [isAuthResolved, setIsAuthResolved] = useState(false);
	const [isDataLoaded, setIsDataLoaded] = useState(false);
	const setSyncing = useGraphStore((s) => s.setSyncing);

	// Zustand Store
	const [isLoaded, setIsLoaded] = useState(false);
	const viewMode = useGraphStore((state) => state.viewMode);
	const networkMode = useGraphStore((state) => state.networkMode);
	const setNetworkMode = useGraphStore((state) => state.setNetworkMode);

	const [editingType, setEditingType] = useState<RelationshipType | null>(null);

	// Derived state
	const selectedCharacter = useGraphStore((state) =>
		state.characters.find((c) => c.id === state.selectedCharId),
	);
	useEffect(() => {
		checkForUpdates();
	}, []);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			setIsAuthResolved(true);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			setIsLoaded(false); // Force a reload of data when login state changes
		});

		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (session) return;
			if (e.ctrlKey && e.key === "z") {
				useGraphStore.temporal.getState().undo();
			}
			if (e.ctrlKey && e.shiftKey && e.key === "z") {
				useGraphStore.temporal.getState().redo();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [session]);

	useEffect(() => {
		if (!isAuthResolved) return;
		const initData = async () => {
			setSyncing(true);
			if (session) {
				const [charsRes, groupsRes, relsRes, typesRes, profileRes, chatsRes] =
					await Promise.all([
						supabase.from("Characters").select("*"),
						supabase.from("Groups").select("id, name, color"),
						supabase.from("Relationships").select("*"),
						supabase.from("RelationshipTypes").select("*"),
						supabase
							.from("Profiles")
							.select("*")
							.eq("userId", session.user.id)
							.single(),
						supabase.from("Chats").select("*"),
					]);
				console.log(chatsRes.data);
				useGraphStore.getState().importData({
					characters: charsRes.data || [],
					groups: groupsRes.data || [],
					relationships: relsRes.data || [],
					relationshipTypes: typesRes.data || [],
				});
				if (profileRes.data) {
					useChatStore.getState().setProfile(profileRes.data as Profile);
					// Auto-set speaker for players
					const fisrtChar = charsRes.data?.filter(
						(c) => c.ownerId === profileRes.data.userId,
					)[0];
					if (fisrtChar) {
						useChatStore.getState().setActiveSpeakerId(fisrtChar.id);
					}
				}
			} else {
				// --- OFFLINE MODE: Load from disk ---
				const localData = await loadFromDisk();
				if (localData) {
					useGraphStore.getState().importData(localData);
				}
			}
			setIsDataLoaded(true); // Data is now in Zustand
			setSyncing(false);
			setIsLoaded(true);
		};

		initData();

		// --- MULTIPLAYER LIVE SYNC ---
		let channel: RealtimeChannel;
		if (session) {
			channel = supabase
				.channel("db-sync")
				// Listen for Character changes
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "Characters" },
					(payload) => {
						const state = useGraphStore.getState();

						if (payload.eventType === "INSERT") {
							// 1. Check if we already have this character (from our own Optimistic UI)
							const exists = state.characters.some(
								(c) => c.id === payload.new.id,
							);
							if (!exists) {
								// 2. Update local state DIRECTLY using setState (DO NOT call addCharacter!)
								useGraphStore.setState({
									characters: [...state.characters, payload.new as Character],
								});
							}
						}
						if (payload.eventType === "UPDATE") {
							useGraphStore.setState({
								characters: state.characters.map((c) =>
									c.id === payload.new.id ? (payload.new as Character) : c,
								),
							});
						}
						if (payload.eventType === "DELETE") {
							useGraphStore.setState({
								characters: state.characters.filter(
									(c) => c.id !== payload.old.id,
								),
							});
						}
					},
				)
				// Listen for Group changes
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "Groups" },
					async () => {
						const { data } = await supabase.from("Groups").select("*");
						if (data) {
							useGraphStore.getState().importData({ groups: data });
						}
					},
				)
				// Listen for Relationship changes (Composite Keys are tricky, so we just reload relationships on change)
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "Relationships" },
					(payload) => {
						const state = useGraphStore.getState();

						if (payload.eventType === "INSERT") {
							// 1. Check if we already have this character (from our own Optimistic UI)
							const exists = state.relationships.some(
								(r) =>
									r.fromId === payload.new.fromId &&
									r.toId === payload.new.toId &&
									r.typeId === payload.new.typeId,
							);
							if (!exists) {
								// 2. Update local state DIRECTLY using setState (DO NOT call addCharacter!)
								useGraphStore.setState({
									relationships: [
										...state.relationships,
										payload.new as Relationship,
									],
								});
							}
						}
						if (payload.eventType === "UPDATE") {
							useGraphStore.setState({
								relationships: state.relationships.map((r) =>
									r.fromId === payload.new.fromId &&
									r.toId === payload.new.toId &&
									r.typeId === payload.new.typeId
										? (payload.new as Relationship)
										: r,
								),
							});
						}
						if (payload.eventType === "DELETE") {
							useGraphStore.setState({
								relationships: state.relationships.filter(
									(r) =>
										!(
											r.fromId === payload.old.fromId &&
											r.toId === payload.old.toId &&
											r.typeId === payload.old.typeId
										),
								),
							});
						}
					},
				)
				// Listen for Type changes
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "RelationshipTypes" },
					async () => {
						const { data } = await supabase
							.from("RelationshipTypes")
							.select("*");
						if (data) {
							useGraphStore.getState().importData({ relationshipTypes: data });
						}
					},
				)
				// Listen for Message changes
				.on(
					"postgres_changes",
					{ event: "INSERT", schema: "public", table: "Messages" },
					async (payload) => {
						const chatStore = useChatStore.getState();
						const msg = payload.new as RealtimeMessagePayload;
						const chatId = msg.chat;
						if (chatStore.messages[chatId]) {
							const exists = chatStore.messages[chatId].some(
								(m) => m.id === msg.id,
							);
							if (!exists) {
								const { data } = await supabase
									.from("Messages")
									.select("*, character:Characters!characterId(name, avatar)")
									.eq("id", msg.id)
									.single();
								if (data) {
									chatStore.addMessage(chatId, data as Message);
								}
							}
						}
					},
				)
				.on(
					"postgres_changes",
					{ event: "UPDATE", schema: "public", table: "Messages" },
					(payload) => {
						const chatStore = useChatStore.getState();
						const msg = payload.new as RealtimeMessagePayload;
						chatStore.updateMessageLocal(msg.chat, msg.id, msg.content);
					},
				)
				.on(
					"postgres_changes",
					{ event: "DELETE", schema: "public", table: "Messages" },
					(payload) => {
						const chatStore = useChatStore.getState();
						const msg = payload.old as RealtimeMessageDeletePayload;
						// Try to remove from all loaded chats
						for (const chatId of Object.keys(chatStore.messages)) {
							chatStore.removeMessageLocal(chatId, msg.id);
						}
					},
				)
				// Listen for Chat changes
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "Chats" },
					() => {
						useChatStore.getState().fetchChats();
					},
				)
				.subscribe();
		}

		return () => {
			if (channel) supabase.removeChannel(channel);
		};
	}, [session, isAuthResolved, setSyncing]);

	useEffect(() => {
		const unsubscribe = useGraphStore.subscribe((state, prevState) => {
			// Don't save if we haven't finished the initial load yet
			if (!isLoaded || session) return;

			// Optional: Only save if the actual graph data changed (ignore UI state like selectedCharId)
			if (
				state.characters !== prevState.characters ||
				state.relationships !== prevState.relationships ||
				state.relationshipTypes !== prevState.relationshipTypes ||
				state.groups !== prevState.groups
			) {
				saveToDisk({
					version: "2",
					characters: state.characters,
					relationships: state.relationships,
					relationshipTypes: state.relationshipTypes,
					groups: state.groups,
				});
			}
		});

		return () => unsubscribe();
	}, [isLoaded, session]);

	// Prevent rendering the app until data is loaded from disk to prevent flashing
	const appReady = isDataLoaded;
	return (
		<>
			<AnimatePresence mode="wait">
				{!appReady && <LoadingScreen key="loading" />}
			</AnimatePresence>

			{/* Main App with a slight fade-in delay */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: appReady ? 1 : 0 }}
				transition={{ duration: 0.8, delay: 0.2 }}
				className="flex h-screen w-screen bg-sidebar text-foreground font-sans overflow-hidden"
			>
				<SidebarProvider
					defaultOpen={true}
					style={{ "--sidebar-width": "22rem" } as React.CSSProperties}
					className="max-h-screen! max-w-screen! pt-6"
				>
					<AppSidebar />
					<SidebarInset
						className={cn(
							"relative flex flex-col overflow-hidden transition-all duration-300 ease-in-out bg-background! shadow-[inset_0_0_10px_2px_rgba(0,0,0,0.2)]! ring-1 ring-inset ring-white/80 dark:ring-black/80",
							viewMode !== "chat" && "bg-dot-grid",
						)}
					>
						<main className="flex-1 relative h-full w-full overflow-hidden flex flex-col">
							{viewMode === "chat" ? (
								<ChatWindow />
							) : viewMode === "network" ? (
								<>
									<NetworkGraph />
									<div className="absolute top-6 right-6 z-10">
										<Tabs
											value={networkMode}
											onValueChange={(v) => setNetworkMode(v)}
											orientation="vertical"
										>
											<TabsList className="bg-background/60 backdrop-blur-md border border-white/10">
												<TabsTrigger
													value="group"
													className="h-7 px-3 text-[11px]"
												>
													<LayoutGrid className="w-3 h-3 mr-1.5" /> Group
												</TabsTrigger>
												<TabsTrigger
													value="global"
													className="h-7 px-3 text-[11px]"
												>
													<Circle className="w-3 h-3 mr-1.5" /> Global
												</TabsTrigger>
											</TabsList>
										</Tabs>
									</div>
								</>
							) : selectedCharacter ? (
								<CharacterGraph />
							) : (
								<h1 className="p-4 z-10 pointer-events-none">
									Character not found
								</h1>
							)}
						</main>
						{editingType && (
							<TypeModal
								type={editingType}
								open={!!editingType}
								onOpenChange={(open) => {
									if (!open) setEditingType(null);
								}}
							/>
						)}
					</SidebarInset>
				</SidebarProvider>{" "}
			</motion.div>
		</>
	);
}

export default App;
