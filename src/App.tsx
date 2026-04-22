import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import CharacterGraph from "@/components/CharacterGraph";
import ChatWindow from "@/components/chat/ChatWindow";
import GraphLoadingOverlay from "@/components/GraphLoadingOverlay";
import LinkView from "@/components/LinkView";
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
import {
	getMessageNotificationPreview,
	sendChatNotification,
} from "@/hooks/use-notifications";
import { getLocalAvatarPath } from "@/lib/avatar-cache";
import { loadFromDisk, saveToDisk } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { checkForUpdates } from "@/lib/updater";
import type { Message, RealtimeMessagePayload } from "@/types/chat";
import LoadingScreen from "./components/LoadingScreen";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { useChatStore } from "./store/useChatStore";

const GRAPH_LOADER_MIN_MS = 1000;

function App() {
	// Supabase
	const [session, setSession] = useState<Session | null>(null);
	const [isAuthResolved, setIsAuthResolved] = useState(false);
	const [isDataLoaded, setIsDataLoaded] = useState(false);
	const setSyncing = useGraphStore((s) => s.setSyncing);
	const queryClient = useQueryClient();

	// Zustand Store
	const [isLoaded, setIsLoaded] = useState(false);
	const viewMode = useGraphStore((state) => state.viewMode);
	const networkMode = useGraphStore((state) => state.networkMode);
	const setNetworkMode = useGraphStore((state) => state.setNetworkMode);
	const characterCount = useGraphStore((state) => state.characters.length);
	const relationshipCount = useGraphStore(
		(state) => state.relationships.length,
	);
	const relationshipTypeCount = useGraphStore(
		(state) => state.relationshipTypes.length,
	);
	const groupCount = useGraphStore((state) => state.groups.length);
	const pendingChatCount = useChatStore(
		(state) => state.pendingMessages.length,
	);

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
			if (session) {
				queryClient.invalidateQueries();
			}
			setIsLoaded(false); // Force a reload of data when login state changes
		});

		return () => subscription.unsubscribe();
	}, [queryClient]);

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
			const minLoadTime = new Promise((resolve) => setTimeout(resolve, 6000)); // Minimum boot sequence time
			if (session) {
				const [charsRes, groupsRes, relsRes, typesRes, profileRes] =
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
					]);

				useGraphStore.getState().importData({
					characters: charsRes.data || [],
					groups: groupsRes.data || [],
					relationships: relsRes.data || [],
					relationshipTypes: typesRes.data || [],
				});

				if (profileRes.data) {
					// Auto-set speaker for players if not set
					if (!useChatStore.getState().activeSpeakerId) {
						const firstChar = charsRes.data?.filter(
							(c) => c.ownerId === profileRes.data.userId,
						)[0];
						if (firstChar) {
							useChatStore.getState().setActiveSpeakerId(firstChar.id);
						}
					}
				}
			} else {
				// --- OFFLINE MODE: Load from disk ---
				const localData = await loadFromDisk();
				if (localData) {
					useGraphStore.getState().importData(localData);
				}
			}

			await minLoadTime;
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
				// Listen for Relationship changes
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "Relationships" },
					(payload) => {
						const state = useGraphStore.getState();

						if (payload.eventType === "INSERT") {
							const exists = state.relationships.some(
								(r) =>
									r.fromId === payload.new.fromId &&
									r.toId === payload.new.toId &&
									r.typeId === payload.new.typeId,
							);
							if (!exists) {
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
						const msg = payload.new as RealtimeMessagePayload;
						const chatId = msg.chat;

						// Directly inject into the cache so the message appears immediately
						// without waiting for the invalidation refetch round-trip.
						queryClient.setQueryData<InfiniteData<Message[], unknown>>(
							["messages", chatId],
							(current) => {
								if (!current || current.pages.length === 0) return current;
								if (current.pages.flat().some((m) => m.id === msg.id))
									return current;
								const pages = [...current.pages];
								pages[pages.length - 1] = [
									...pages[pages.length - 1],
									msg as Message,
								];
								return { ...current, pages };
							},
						);

						// Invalidate for eventual consistency (fetches character join etc.)
						queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
						queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
						queryClient.invalidateQueries({ queryKey: ["chats"] });

						// Send native notification for incoming user messages.
						if (
							msg.userId !== session.user.id &&
							!msg.content.startsWith("[system]")
						) {
							const { data } = await supabase
								.from("Messages")
								.select("*, character:Characters!characterId(name, avatar)")
								.eq("id", msg.id)
								.single();

							if (data) {
								const charName = data.character?.name || "Someone";
								const content = (data as Message).content;

								// Skip system messages — they don't need notifications
								if (content.startsWith("[system]")) return;

								const preview = getMessageNotificationPreview(content);
								const localAvatar = await getLocalAvatarPath(
									data.character?.avatar,
								);
								sendChatNotification({
									charName,
									body: preview,
									avatar: localAvatar,
								});
							}
						}
					},
				)
				.on(
					"postgres_changes",
					{ event: "UPDATE", schema: "public", table: "Messages" },
					(payload) => {
						const msg = payload.new as RealtimeMessagePayload;
						queryClient.invalidateQueries({ queryKey: ["messages", msg.chat] });
						queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
					},
				)
				.on(
					"postgres_changes",
					{ event: "DELETE", schema: "public", table: "Messages" },
					() => {
						queryClient.invalidateQueries({ queryKey: ["messages"] });
						queryClient.invalidateQueries({ queryKey: ["latestMessages"] });
					},
				)
				// Listen for Chat changes
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "Chats" },
					() => {
						queryClient.invalidateQueries({ queryKey: ["chats"] });
					},
				)
				.subscribe();
		}

		return () => {
			if (channel) supabase.removeChannel(channel);
		};
	}, [session, isAuthResolved, setSyncing, queryClient]);

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
	const graphLoadKey = useMemo(() => {
		if (viewMode === "network") {
			return networkMode === "groups" ? "network:groups" : "network";
		}

		if (viewMode === "link") {
			return "link";
		}

		if (viewMode === "chat") {
			return "chat";
		}

		if (viewMode === "character" && selectedCharacter) {
			return "character";
		}

		return null;
	}, [networkMode, selectedCharacter, viewMode]);
	const [loadingGraphKey, setLoadingGraphKey] = useState<string | null>(null);
	const graphLoaderStartedAtRef = useRef(0);
	const graphLoaderTimeoutRef = useRef<number | null>(null);
	const isGraphLoading = Boolean(
		graphLoadKey && loadingGraphKey === graphLoadKey,
	);

	useLayoutEffect(() => {
		if (graphLoaderTimeoutRef.current !== null) {
			window.clearTimeout(graphLoaderTimeoutRef.current);
			graphLoaderTimeoutRef.current = null;
		}

		if (!appReady || !graphLoadKey) {
			setLoadingGraphKey(null);
			return;
		}

		graphLoaderStartedAtRef.current = performance.now();
		setLoadingGraphKey(graphLoadKey);

		if (graphLoadKey === "link" || graphLoadKey === "chat") {
			graphLoaderTimeoutRef.current = window.setTimeout(() => {
				graphLoaderTimeoutRef.current = null;
				setLoadingGraphKey((currentKey) =>
					currentKey === graphLoadKey ? null : currentKey,
				);
			}, GRAPH_LOADER_MIN_MS);
		}
	}, [appReady, graphLoadKey]);

	useEffect(() => {
		return () => {
			if (graphLoaderTimeoutRef.current !== null) {
				window.clearTimeout(graphLoaderTimeoutRef.current);
			}
		};
	}, []);

	const handleGraphReady = useCallback((readyKey: string | null) => {
		if (!readyKey) {
			return;
		}

		const elapsed = performance.now() - graphLoaderStartedAtRef.current;
		const remaining = Math.max(0, GRAPH_LOADER_MIN_MS - elapsed);
		const clearMatchingLoader = () => {
			setLoadingGraphKey((currentKey) =>
				currentKey === readyKey ? null : currentKey,
			);
		};

		if (graphLoaderTimeoutRef.current !== null) {
			window.clearTimeout(graphLoaderTimeoutRef.current);
			graphLoaderTimeoutRef.current = null;
		}

		if (remaining > 0) {
			graphLoaderTimeoutRef.current = window.setTimeout(() => {
				graphLoaderTimeoutRef.current = null;
				clearMatchingLoader();
			}, remaining);
			return;
		}

		clearMatchingLoader();
	}, []);

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
					className="max-h-screen! max-w-screen! pt-8"
				>
					<AppSidebar />
					<SidebarInset
						className={cn(
							"relative flex flex-col overflow-hidden transition-all duration-300 ease-in-out bg-background! ring-0 border border-border/30 rounded-2xl ml-8 mb-8 mr-8 after:content-[''] after:absolute after:inset-0 after:rounded-2xl after:shadow-[inset_0_0_30px_rgba(0,0,0,0.1)] after:pointer-events-none after:z-[100]",
							viewMode === "chat" && "shadow-2xl",
							viewMode !== "chat" && "bg-dot-grid",
						)}
					>
						<main className="flex-1 relative h-full w-full overflow-hidden flex flex-col">
							{appReady && (
								<>
									{viewMode === "chat" ? (
										<ChatWindow />
									) : viewMode === "link" ? (
										<LinkView />
									) : viewMode === "network" ? (
										<>
											<NetworkGraph
												onReady={() => handleGraphReady(graphLoadKey)}
											/>
											{networkMode !== "groups" && (
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
											)}
										</>
									) : selectedCharacter ? (
										<CharacterGraph
											onReady={() => handleGraphReady(graphLoadKey)}
										/>
									) : (
										<h1 className="p-4 z-10 pointer-events-none">
											Character not found
										</h1>
									)}
									<AnimatePresence>
										{isGraphLoading && graphLoadKey && (
											<GraphLoadingOverlay
												key={graphLoadKey}
												variant={
													viewMode === "network" && networkMode === "groups"
														? "groups"
														: viewMode === "network"
															? "network"
															: viewMode === "link"
																? "link"
																: viewMode === "chat"
																	? "chat"
																	: "character"
												}
												subject={selectedCharacter?.name}
												nodeCount={characterCount}
												edgeCount={
													networkMode === "groups" ? 0 : relationshipCount
												}
												typeCount={relationshipTypeCount}
												pendingCount={pendingChatCount}
												groupCount={groupCount}
											/>
										)}
									</AnimatePresence>
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
					</SidebarInset>
				</SidebarProvider>{" "}
			</motion.div>
		</>
	);
}

export default App;
