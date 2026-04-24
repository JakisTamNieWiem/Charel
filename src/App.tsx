import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AppViewport from "@/components/AppViewport";
import AppSidebar from "@/components/Sidebar/Sidebar";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, Relationship } from "@/types/types";
import "./styles.css";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "motion/react";
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
import { SidebarProvider } from "./components/ui/sidebar";
import { useChatStore } from "./store/useChatStore";

function App() {
	// Supabase
	const [session, setSession] = useState<Session | null>(null);
	const [isAuthResolved, setIsAuthResolved] = useState(false);
	const [isDataLoaded, setIsDataLoaded] = useState(false);
	const setSyncing = useGraphStore((s) => s.setSyncing);
	const queryClient = useQueryClient();

	// Zustand Store
	const [isLoaded, setIsLoaded] = useState(false);
	const pathname = useLocation({
		select: (location) => location.pathname,
	});
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

						// Send native notification if not active chat or app is not focused
						if (
							useChatStore.getState().activeChatId !== chatId ||
							!document.hasFocus()
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

								// Use group cover if available, otherwise fall back to sender avatar
								const { data: chatData } = await supabase
									.from("Chats")
									.select("isGroup, cover")
									.eq("id", chatId)
									.single();

								const avatarUrl =
									chatData?.isGroup && chatData.cover
										? chatData.cover
										: data.character?.avatar;

								const localAvatar = await getLocalAvatarPath(avatarUrl);
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
					<AppViewport pathname={pathname} />
				</SidebarProvider>{" "}
			</motion.div>
		</>
	);
}

export default App;
