import { createFileRoute } from "@tanstack/react-router";
import SelectedCharacterPage from "@/components/SelectedCharacterPage";

export const Route = createFileRoute("/characters")({
	component: SelectedCharacterPage,
});
