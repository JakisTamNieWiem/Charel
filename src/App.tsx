import { AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import CharacterGraph from "@/components/CharacterGraph";
import RelationshipModal from "@/components/RelationshipModal";
import Sidebar from "@/components/Sidebar";
import TypeModal from "@/components/TypeModal";
import { useGraphStore } from "@/store/useGraphStore";
import type { Relationship, RelationshipType } from "@/types";
import "./styles.css";

function App() {
	// Zustand Store

	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);
	const allChars = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const types = useGraphStore((state) => state.types);

	// Handlers

	const addType = useGraphStore((state) => state.addType);

	const updateType = useGraphStore((state) => state.updateType);

	const addRelationship = useGraphStore((state) => state.addRelationship);

	const deleteRelationship = useGraphStore((state) => state.deleteRelationship);

	const updateRelationship = useGraphStore((state) => state.updateRelationship);

	const [editingType, setEditingType] = useState<RelationshipType | null>(null);
	const [showRelModal, setShowRelModal] = useState(false);
	const [editingRel, setEditingRel] = useState<Relationship | null>(null);
	const [deletingRel, setDeletingRel] = useState<{
		fromId: string;
		toId: string;
		typeId: string;
	} | null>(null);

	// Derived state
	const selectedCharacter = useGraphStore((state) =>
		state.characters.find((c) => c.id === state.selectedCharId),
	);

	const relatedCharacters = useMemo(() => {
		if (!selectedId) return [];
		const rels = relationships.filter(
			(r) => r.fromId === selectedId || r.toId === selectedId,
		);
		const ids = new Set(rels.flatMap((r) => [r.fromId, r.toId]));
		ids.delete(selectedId);
		return allChars.filter((c) => ids.has(c.id));
	}, [allChars, relationships, selectedId]);

	const activeRelationships = useMemo(() => {
		if (!selectedId) return [];
		return relationships.filter(
			(r) => r.fromId === selectedId || r.toId === selectedId,
		);
	}, [relationships, selectedId]);

	return (
		<div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
			{/* Sidebar */}
			<Sidebar />
			{/* Main Content */}
			<main className="flex-1 relative overflow-hidden flex flex-col">
				{/* Header */}
				<header className="p-6 flex items-center justify-between z-10">
					<div>
						<h2 className="text-4xl font-bold tracking-tighter uppercase italic serif">
							{selectedCharacter?.name || "Select a character"}
						</h2>
						<p className="text-sm opacity-50 max-w-md">
							{selectedCharacter?.description}
						</p>
					</div>
					{selectedId && (
						<RelationshipModal
							fromId={selectedId}
							characters={allChars}
							types={types}
							onSave={addRelationship}
						/>
					)}
				</header>

				{/* Graph Area */}
				<div className="flex-1 relative overflow-hidden">
					{selectedCharacter ? (
						<CharacterGraph
							centerChar={selectedCharacter}
							relatedChars={relatedCharacters}
							allChars={allChars}
							relationships={activeRelationships}
							types={types}
							onSelect={setSelectedCharId}
							onDeleteRel={deleteRelationship}
							onEditRel={updateRelationship}
						/>
					) : (
						<h1>Character not found</h1>
					)}
				</div>

				{/* Legend */}
				<div className="p-6 flex gap-6 z-10 overflow-x-auto no-scrollbar">
					{types.map((type) => (
						<div
							key={type.id}
							className="flex items-center gap-2 whitespace-nowrap group relative"
						>
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: type.color }}
							/>
							<span className="text-[10px] uppercase font-bold tracking-widest opacity-70">
								{type.label}
							</span>
							<div className="absolute bottom-full left-0 mb-2 p-2 bg-white text-black rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-48 z-50">
								{type.description}
							</div>
						</div>
					))}
				</div>
			</main>

			{/* Modals */}
			<AnimatePresence>
				{editingType && (
					<TypeModal
						type={editingType}
						onClose={() => setEditingType(null)}
						onSave={(t: RelationshipType) =>
							editingType.id ? updateType(t) : addType(t)
						}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

export default App;
