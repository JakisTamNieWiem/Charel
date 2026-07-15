import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthProvider";
import { relationshipVersionKeys } from "@/hooks/useRelationshipVersions";
import {
	applyRelationshipChange,
	applyRowChange,
	type RowChange,
} from "@/lib/realtime-graph";
import { supabase } from "@/lib/supabase";
import { type GraphState, useGraphStore } from "@/store/useGraphStore";
import type {
	Character,
	Group,
	Relationship,
	RelationshipType,
} from "@/types/types";

function getSyncError(errors: unknown[]) {
	const error = errors.find(Boolean);
	return error instanceof Error ? error.message : "Could not synchronize data";
}

function setRealtimeState(state: Partial<GraphState>) {
	const history = useGraphStore.temporal.getState();
	history.pause();
	try {
		useGraphStore.setState(state);
	} finally {
		history.resume();
	}
}

export function useRealtimeSync() {
	const { session, loading } = useAuth();
	const queryClient = useQueryClient();

	useEffect(() => {
		const store = useGraphStore.getState();
		if (loading) {
			store.setSyncState("initializing", { initialized: false });
			return;
		}

		if (!session) {
			store.setSyncState("offline", { initialized: true });
			return;
		}

		let active = true;
		let dataReady = false;
		let realtimeError: string | null = null;
		store.setSyncState("syncing", { initialized: false });

		const initialize = async () => {
			const [characters, groups, relationships, relationshipTypes] =
				await Promise.all([
					supabase.from("Characters").select("*"),
					supabase.from("Groups").select("id, name, color"),
					supabase.from("Relationships").select("*"),
					supabase.from("RelationshipTypes").select("*"),
				]);

			if (!active) return;
			const errors = [
				characters.error,
				groups.error,
				relationships.error,
				relationshipTypes.error,
			];
			if (errors.some(Boolean)) {
				store.setSyncState("error", {
					error: getSyncError(errors),
					initialized: true,
				});
				return;
			}

			const history = useGraphStore.temporal.getState();
			history.pause();
			try {
				store.importData({
					characters: characters.data ?? [],
					groups: groups.data ?? [],
					relationships: relationships.data ?? [],
					relationshipTypes: relationshipTypes.data ?? [],
				});
				history.clear();
			} finally {
				history.resume();
			}
			dataReady = true;
			store.setSyncState(realtimeError ? "error" : "connected", {
				error: realtimeError,
				initialized: true,
			});
		};

		void initialize().catch((error: unknown) => {
			if (!active) return;
			store.setSyncState("error", {
				error: getSyncError([error]),
				initialized: true,
			});
		});

		const channel = supabase
			.channel("db-sync")
			.on<Character>(
				"postgres_changes",
				{ event: "*", schema: "public", table: "Characters" },
				(payload) => {
					const state = useGraphStore.getState();
					setRealtimeState({
						characters: applyRowChange(
							state.characters,
							payload as RowChange<Character>,
						),
					});
				},
			)
			.on<Group>(
				"postgres_changes",
				{ event: "*", schema: "public", table: "Groups" },
				(payload) => {
					const state = useGraphStore.getState();
					setRealtimeState({
						groups: applyRowChange(state.groups, payload as RowChange<Group>),
					});
				},
			)
			.on<Relationship>(
				"postgres_changes",
				{ event: "*", schema: "public", table: "Relationships" },
				(payload) => {
					const state = useGraphStore.getState();
					setRealtimeState({
						relationships: applyRelationshipChange(
							state.relationships,
							payload as RowChange<Relationship>,
						),
					});
					void queryClient.invalidateQueries({
						queryKey: relationshipVersionKeys.all,
					});
				},
			)
			.on<RelationshipType>(
				"postgres_changes",
				{ event: "*", schema: "public", table: "RelationshipTypes" },
				(payload) => {
					const state = useGraphStore.getState();
					setRealtimeState({
						relationshipTypes: applyRowChange(
							state.relationshipTypes,
							payload as RowChange<RelationshipType>,
						),
					});
				},
			)
			.subscribe((status, error) => {
				if (!active) return;

				if (status === "SUBSCRIBED") {
					realtimeError = null;
					if (dataReady) {
						useGraphStore.getState().setSyncState("connected", {
							initialized: true,
						});
					}
					return;
				}

				if (
					status === "CHANNEL_ERROR" ||
					status === "TIMED_OUT" ||
					status === "CLOSED"
				) {
					console.error("Realtime subscription failed:", status, error);
					realtimeError =
						error?.message ?? "Realtime connection was interrupted";
					useGraphStore.getState().setSyncState("error", {
						error: realtimeError,
						initialized: dataReady,
					});
				}
			});

		return () => {
			active = false;
			void supabase.removeChannel(channel);
		};
	}, [loading, queryClient, session]);
}
