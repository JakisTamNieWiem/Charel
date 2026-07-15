import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/chat";

export function useProfile() {
	return useQuery<Profile | null>({
		queryKey: ["profile"],
		queryFn: async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return null;

			const { data, error } = await supabase
				.from("Profiles")
				.select("*")
				.eq("userId", session.user.id)
				.single();

			if (error) {
				console.error("Error fetching profile:", error);
				return null;
			}

			return data as Profile;
		},
		staleTime: Infinity, // Profile doesn't change often
	});
}
