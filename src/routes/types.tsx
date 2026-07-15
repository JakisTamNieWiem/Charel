import { createFileRoute } from "@tanstack/react-router";
import SelectedCharacterPage from "@/components/SelectedCharacterPage";

export const Route = createFileRoute("/types")({
	component: SelectedCharacterPage,
});
