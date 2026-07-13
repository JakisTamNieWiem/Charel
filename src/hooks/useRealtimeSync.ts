import { useEffect } from "react";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useGraphStore } from "@/store/useGraphStore";
import type {
	Character,
	Group,
	Relationship,
	RelationshipType,
} from "@/types/types";

export function useRealtimeSync() {
	const { session } = useAuth();
	useEffect(() => {
		if (!session) return;

		const initData = async () => {
			const [charsRes, groupsRes, relsRes, typesRes] = await Promise.all([
				supabase.from("Characters").select("*"),
				supabase.from("Groups").select("id, name, color"),
				supabase.from("Relationships").select("*"),
				supabase.from("RelationshipTypes").select("*"),
			]);

			useGraphStore.getState().importData({
				characters: charsRes.data || [],
				groups: groupsRes.data || [],
				relationships: relsRes.data || [],
				relationshipTypes: typesRes.data || [],
			});
		};

		initData();

		const channel = supabase
			.channel("db-sync")
			// Listen for Character changes
			.on<Character>(
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
								characters: [...state.characters, payload.new],
							});
						}
					}
					if (payload.eventType === "UPDATE") {
						useGraphStore.setState({
							characters: state.characters.map((c) =>
								c.id === payload.new.id ? payload.new : c,
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
			.on<Group>(
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
			.on<Relationship>(
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
								relationships: [...state.relationships, payload.new],
							});
						}
					}
					if (payload.eventType === "UPDATE") {
						useGraphStore.setState({
							relationships: state.relationships.map((r) =>
								r.fromId === payload.new.fromId &&
								r.toId === payload.new.toId &&
								r.typeId === payload.new.typeId
									? payload.new
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
			.on<RelationshipType>(
				"postgres_changes",
				{ event: "*", schema: "public", table: "RelationshipTypes" },
				async () => {
					const { data } = await supabase.from("RelationshipTypes").select("*");
					if (data) {
						useGraphStore.getState().importData({ relationshipTypes: data });
					}
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [session]);
}
