import { useEffect, useState } from "react";
import CharacterGraph from "@/components/CharacterGraph";
import NetworkGraph from "@/components/NetworkGraph";
import AppSidebar from "@/components/Sidebar/Sidebar";
import TypeModal from "@/components/TypeModal";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, Relationship, RelationshipType } from "@/types/types";
import "./styles.css";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "motion/react";
import { loadFromDisk, saveToDisk } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { checkForUpdates } from "@/lib/updater"; // <--- Add this import
import LoadingScreen from "./components/LoadingScreen";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "./components/ui/sidebar";
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
				// --- ONLINE MODE: Fetch from 4 tables concurrently ---
				const [charsRes, groupsRes, relsRes, typesRes, profileRes] =
					await Promise.all([
						supabase
							.from("Characters")
							.select("id, name, description, avatar, groupId"),
						supabase.from("Groups").select("id, name, color"),
						supabase
							.from("Relationships")
							.select("fromId, toId, typeId, description, value"),
						supabase
							.from("RelationshipTypes")
							.select("id, color, description, label, value"),
						supabase
							.from("Profiles")
							.select("*")
							.eq("userId", session.user.id)
							.single(),
					]);

				useGraphStore.getState().importData({
					characters: charsRes.data || [],
					groups: groupsRes.data || [],
					relationships: relsRes.data || [],
					relationshipTypes: typesRes.data || [],
				});
				if (profileRes.data)
					useChatStore.getState().setProfile(profileRes.data);
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
	const appReady = isAuthResolved && isDataLoaded;
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
					<SidebarInset className="relative flex flex-col overflow-hidden transition-all duration-300 ease-in-out bg-background! bg-dot-grid shadow-[inset_0_0_10px_2px_rgba(0,0,0,0.2)]! ring-1 ring-inset ring-white/80 dark:ring-black/80">
						<main className="flex-1 relative h-full w-full overflow-hidden flex flex-col">
							{viewMode === "network" ? (
								<NetworkGraph />
							) : selectedCharacter ? (
								<CharacterGraph />
							) : (
								<h1 className="p-4 z-10 pointer-events-none">
									Character not found
								</h1>
							)}
							<SidebarTrigger
								variant="secondary"
								className="absolute bottom-0 m-2 pointer-events-auto z-50"
							/>
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
