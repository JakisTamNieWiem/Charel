import { createFileRoute } from "@tanstack/react-router";
import NetworkPage from "@/components/NetworkPage";
import { useGraphStore } from "@/store/useGraphStore";

export const Route = createFileRoute("/network")({
	beforeLoad: () => {
		useGraphStore.getState().setNetworkMode("group");
	},
	component: NetworkPage,
});
