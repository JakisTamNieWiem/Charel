import CharacterGraph from "@/components/CharacterGraph";
import { useGraphStore } from "@/store/useGraphStore";

export default function SelectedCharacterPage() {
	const selectedCharacter = useGraphStore((state) =>
		state.characters.find((character) => character.id === state.selectedCharId),
	);

	return selectedCharacter ? (
		<CharacterGraph key={selectedCharacter.id} />
	) : (
		<h1 className="p-4 z-10 pointer-events-none">Character not found</h1>
	);
}
