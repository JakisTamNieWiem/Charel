import { createFileRoute } from "@tanstack/react-router";
import NetworkPage from "@/components/NetworkPage";
import { useGraphStore } from "@/store/useGraphStore";

export const Route = createFileRoute("/groups")({
	beforeLoad: () => {
		useGraphStore.getState().setNetworkMode("groups");
	},
	component: NetworkPage,
});
