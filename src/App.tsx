import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import CharacterGraph from "@/components/CharacterGraph";
import NetworkGraph from "@/components/NetworkGraph";
import RelationshipModal from "@/components/RelationshipModal";
import Sidebar from "@/components/Sidebar";
import TypeModal from "@/components/TypeModal";
import { useGraphStore } from "@/store/useGraphStore";
import type { RelationshipType } from "@/types";
import "./styles.css";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFromDisk, saveToDisk } from "@/lib/storage";
import { checkForUpdates } from "@/lib/updater"; // <--- Add this import

function App() {
	// Zustand Store
	const [isLoaded, setIsLoaded] = useState(false);
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const allChars = useGraphStore((state) => state.characters);
	const viewMode = useGraphStore((state) => state.viewMode);

	const types = useGraphStore((state) => state.relationshipTypes);

	// Handlers

	const addRelationship = useGraphStore((state) => state.addRelationship);

	const [editingType, setEditingType] = useState<RelationshipType | null>(null);
	const [openRelModal, setOpenRelModal] = useState(false);

	// Derived state
	const selectedCharacter = useGraphStore((state) =>
		state.characters.find((c) => c.id === state.selectedCharId),
	);
	useEffect(() => {
		checkForUpdates();
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === "z") {
				useGraphStore.temporal.getState().undo();
			}
			if (e.ctrlKey && e.shiftKey && e.key === "z") {
				useGraphStore.temporal.getState().redo();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	useEffect(() => {
		// 1. Load data on startup
		const initStorage = async () => {
			const savedData = await loadFromDisk();
			if (savedData) {
				// Assuming your store has an importData action
				// that sets { characters, relationships, types }
				useGraphStore.getState().importData(savedData);
			} else {
				// FIRST LAUNCH: No save file exists.
				// The store is already using `defaultData`.
				// Let's instantly save this default state to disk so the file is created.
				const initialState = useGraphStore.getState();
				await saveToDisk({
					version: "1.0.0",
					characters: initialState.characters,
					relationships: initialState.relationships,
					relationshipTypes: initialState.relationshipTypes,
					groups: initialState.groups,
				});
			}
			setIsLoaded(true);
		};

		initStorage();

		// 2. Subscribe to Zustand changes to Auto-Save
		// This runs every time ANY state in useGraphStore changes
		const unsubscribe = useGraphStore.subscribe((state, prevState) => {
			// Don't save if we haven't finished the initial load yet
			if (!isLoaded) return;

			// Optional: Only save if the actual graph data changed (ignore UI state like selectedCharId)
			if (
				state.characters !== prevState.characters ||
				state.relationships !== prevState.relationships ||
				state.relationshipTypes !== prevState.relationshipTypes ||
				state.groups !== prevState.groups
			) {
				saveToDisk({
					version: "1.0.0",
					characters: state.characters,
					relationships: state.relationships,
					relationshipTypes: state.relationshipTypes,
					groups: state.groups,
				});
			}
		});

		return () => unsubscribe();
	}, [isLoaded]);

	// Prevent rendering the app until data is loaded from disk to prevent flashing
	if (!isLoaded) {
		return (
			<div className="w-screen h-screen bg-[#141414] flex items-center justify-center text-white/50 tracking-widest uppercase text-xs">
				Initializing Secure Storage...
			</div>
		);
	}
	return (
		<div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
			{/* Sidebar */}
			<Sidebar />
			{/* Main Content */}
			<main className="flex-1 relative overflow-hidden flex flex-col">
				{viewMode === "network" ? (
					<NetworkGraph />
				) : (
					<>
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
							<Button
								onClick={(e) => {
									e.preventDefault();
									setOpenRelModal(true);
								}}
								className="px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-full flex items-center gap-2"
							>
								<Plus className="w-4 h-4" /> New Relation
							</Button>
							{selectedId && (
								<RelationshipModal
									fromId={selectedId}
									characters={allChars}
									types={types}
									onSave={addRelationship}
									open={openRelModal}
									onOpenChange={setOpenRelModal}
								/>
							)}
						</header>

						{/* Graph Area */}
						<div className="flex-1 relative overflow-hidden">
							{selectedCharacter ? (
								<CharacterGraph />
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
					</>
				)}
			</main>

			{/* Modals */}
			<AnimatePresence>
				{editingType && (
					<TypeModal
						type={editingType}
						open={!!editingType}
						onOpenChange={(open) => {
							if (!open) setEditingType(null);
						}}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

export default App;
