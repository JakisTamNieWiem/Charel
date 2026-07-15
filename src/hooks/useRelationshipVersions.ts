import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Database, Tables } from "@/types/database.types";

export type UnreadRelationshipVersion =
	Database["public"]["Functions"]["get_unread_relationship_versions"]["Returns"][number];

export type RelationshipVersion = Omit<
	Tables<"relationship_versions">,
	"changed_by"
>;

export const relationshipVersionKeys = {
	all: ["relationship-versions"] as const,
	unread: (userId: string) =>
		[...relationshipVersionKeys.all, "unread", userId] as const,
	history: (relationshipId: string) =>
		[...relationshipVersionKeys.all, "history", relationshipId] as const,
};

export function useUnreadRelationshipVersions() {
	const { session } = useAuth();
	const userId = session?.user.id ?? "";

	return useQuery({
		queryKey: relationshipVersionKeys.unread(userId),
		queryFn: async () => {
			const { data, error } = await supabase.rpc(
				"get_unread_relationship_versions",
			);
			if (error) throw error;
			return data;
		},
		enabled: Boolean(userId),
	});
}

export function useRelationshipHistory(relationshipId: string | undefined) {
	const { session } = useAuth();

	return useQuery<RelationshipVersion[]>({
		queryKey: relationshipVersionKeys.history(relationshipId ?? ""),
		queryFn: async () => {
			if (!relationshipId) return [];

			const { data, error } = await supabase
				.from("relationship_versions")
				.select(
					"id, relationship_id, from_id, to_id, relationship_type_id, type_label, description, value_override, effective_value, change_kind, changed_at",
				)
				.eq("relationship_id", relationshipId)
				.order("id", { ascending: false });
			if (error) throw error;
			return data;
		},
		enabled: Boolean(session && relationshipId),
	});
}

export function useMarkRelationshipVersionsRead() {
	const { session } = useAuth();
	const queryClient = useQueryClient();
	const unreadQueryKey = relationshipVersionKeys.unread(session?.user.id ?? "");

	return useMutation({
		mutationFn: async ({
			relationshipId,
			latestVersionId,
		}: {
			relationshipId: string;
			latestVersionId: number;
		}) => {
			const { error } = await supabase.rpc("mark_relationship_versions_read", {
				p_relationship_id: relationshipId,
				p_last_read_version_id: latestVersionId,
			});
			if (error) throw error;
		},
		onMutate: ({ relationshipId }) => {
			const previous =
				queryClient.getQueryData<UnreadRelationshipVersion[]>(unreadQueryKey);
			queryClient.setQueryData<UnreadRelationshipVersion[]>(
				unreadQueryKey,
				(current) =>
					current?.filter((row) => row.relationship_id !== relationshipId) ??
					[],
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			queryClient.setQueryData(unreadQueryKey, context?.previous);
			toast.error("Could not mark relationship update as read");
		},
		onSettled: async () => {
			if (!session) return;
			await queryClient.invalidateQueries({
				queryKey: unreadQueryKey,
			});
		},
	});
}
