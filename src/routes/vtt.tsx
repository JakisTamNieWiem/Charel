import { createFileRoute } from "@tanstack/react-router";
import VirtualTabletopViewport from "@/components/VTT/VirtualTabletopViewport";

export const Route = createFileRoute("/vtt")({
	component: VTTPage,
});

function VTTPage() {
	return <VirtualTabletopViewport />;
}
