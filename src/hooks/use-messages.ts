import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useMessages(roomId: string) {
	return useQuery({
		queryKey: ["messages", roomId], // The cache key
		queryFn: async () => {
			const { data, error } = await supabase
				.from("Messages")
				.select("*")
				.eq("chat", roomId)
				.order("created_at", { ascending: true });

			if (error) throw error;
			return data;
		},
		enabled: !!roomId, // Only run if a room is selected
	});
}
