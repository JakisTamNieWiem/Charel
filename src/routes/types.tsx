import { createFileRoute } from "@tanstack/react-router";
import CharacterGraph from "@/components/CharacterGraph";
import { useGraphStore } from "@/store/useGraphStore";

export const Route = createFileRoute("/types")({
	component: TypesPage,
});

function TypesPage() {
	const selectedCharacter = useGraphStore((state) =>
		state.characters.find((c) => c.id === state.selectedCharId),
	);

	return selectedCharacter ? (
		<CharacterGraph />
	) : (
		<h1 className="p-4 z-10 pointer-events-none">Character not found</h1>
	);
}
