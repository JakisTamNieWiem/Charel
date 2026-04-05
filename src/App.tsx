import { useEffect, useState } from "react";
import CharacterGraph from "@/components/CharacterGraph";
import NetworkGraph from "@/components/NetworkGraph";
import RelationshipModal from "@/components/RelationshipModal";
import Sidebar from "@/components/Sidebar/Sidebar";
import TypeModal from "@/components/TypeModal";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, Relationship, RelationshipType } from "@/types/types";
import "./styles.css";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFromDisk, saveToDisk } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { checkForUpdates } from "@/lib/updater"; // <--- Add this import
import { Badge } from "./components/ui/badge";
import { useChatStore } from "./store/useChatStore";

function App() {
	// Supabase
	const [session, setSession] = useState<Session | null>(null);
	// Zustand Store
	const [isLoaded, setIsLoaded] = useState(false);
	const types = useGraphStore((state) => state.relationshipTypes);
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const viewMode = useGraphStore((state) => state.viewMode);

	// Handlers

	const addRelationship = useGraphStore((state) => state.addRelationship);

	const [editingType, setEditingType] = useState<RelationshipType | null>(null);
	const [openRelModal, setOpenRelModal] = useState(false);

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
			if (!session) return;
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
		const initData = async () => {
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
	}, [session]);

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
	if (!isLoaded) {
		return (
			<div className="w-screen h-screen bg-[#141414] flex items-center justify-center text-white/50 tracking-widest uppercase text-xs">
				Initializing Secure Storage...
			</div>
		);
	}
	return (
		<div className="flex h-screen w-screen bg-background text-white font-sans overflow-hidden bg-dot-grid">
			{/* Sidebar */}
			<Sidebar />
			{/* Main Content */}
			<main className="flex-1 relative overflow-hidden flex flex-col">
				{viewMode === "network" ? (
					<NetworkGraph />
				) : (
					<>
						{/* Header */}
						<header className="absolute w-full p-6 flex items-center justify-between z-15">
							<div className="bg-background/40  backdrop-blur-sm  p-4 rounded-2xl">
								<h2
									style={{ fontFamily: "Geist Variable" }}
									className="text-4xl font-bold tracking-tighter uppercase italic serif"
								>
									{selectedCharacter?.name || "Select a character"}
								</h2>
								<p className="text-sm opacity-50 max-w-md">
									{selectedCharacter?.description}
								</p>
							</div>

							<Button
								onClick={(e) => {
									e.preventDefault();
									setOpenRelModal(true);
								}}
								className="px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-full flex items-center gap-2"
							>
								<Plus className="w-4 h-4" /> New Relation
							</Button>
							{selectedId && (
								<RelationshipModal
									fromId={selectedId}
									onSave={addRelationship}
									open={openRelModal}
									onOpenChange={setOpenRelModal}
								/>
							)}
						</header>

						{/* Graph Area */}
						<div className="flex-1 relative overflow-hidden">
							{selectedCharacter ? (
								<CharacterGraph />
							) : (
								<h1 className="p-4">Character not found</h1>
							)}
						</div>

						{/* Legend */}
						<div className="h-full absolute right-0 top-0 p-6 flex flex-col flex-wrap justify-center items-end gap-3 z-10 overflow-x-auto no-scrollbar">
							{types.map((type) => (
								<Badge
									variant={"secondary"}
									key={type.id}
									style={{ "--badge-color": type.color } as React.CSSProperties}
									className="pr-1 bg-background/40 backdrop-blur-md"
								>
									<span className="text-[10px] uppercase font-bold tracking-widest">
										{type.label}
									</span>
									<div
										className="size-3 rounded-full"
										style={{ backgroundColor: type.color }}
									/>
								</Badge>
							))}
						</div>
					</>
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
		</div>
	);
}

export default App;
