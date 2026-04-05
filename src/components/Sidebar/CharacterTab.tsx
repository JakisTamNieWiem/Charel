import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CharacterModal from "@/components/CharacterModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character } from "@/types/types";
import ConfirmModal from "../ConfirmModal";

export default function CharacterTab() {
	const allCharacters = useGraphStore((state) => state.characters);
	const addCharacter = useGraphStore((state) => state.addCharacter);
	const updateCharacter = useGraphStore((state) => state.updateCharacter);
	const deleteCharacter = useGraphStore((state) => state.deleteCharacter);
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);

	const [editingCharacter, setEditingCharacter] = useState<
		Character | "new" | null
	>(null);
	const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(
		null,
	);

	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	useEffect(() => {
		if (selectedId) {
			const timer = setTimeout(() => {
				const element = itemRefs.current.get(selectedId);
				if (element) {
					// In Shadcn Sidebar, SidebarContent is the scrollable parent.
					// We find the closest parent that handles scrolling.
					const scrollParent = element.closest('[data-sidebar="content"]');

					if (scrollParent) {
						const parentRect = scrollParent.getBoundingClientRect();
						const elementRect = element.getBoundingClientRect();

						const isAbove = elementRect.top < parentRect.top;
						const isBelow = elementRect.bottom > parentRect.bottom;

						if (isAbove || isBelow) {
							element.scrollIntoView({
								behavior: "smooth",
								block: "nearest", // Ensures it only moves as much as needed
							});
						}
					}
				}
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [selectedId]);

	return (
		<div>
			<div className="p-2 pr-0 min-h-9 flex items-center justify-between sticky top-0 bg-sidebar z-50">
				<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
					Characters
				</h2>
				<Button
					onClick={() => setEditingCharacter("new")}
					variant="ghost"
					className=""
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>

			<div className=" space-y-2">
				{[...allCharacters]
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((char) => (
						<div
							key={char.id}
							ref={(el) => {
								if (el) itemRefs.current.set(char.id, el);
								else itemRefs.current.delete(char.id);
							}}
							onClick={() => setSelectedCharId(char.id)}
							className={cn(
								"group/character px-3 py-2 rounded-lg border transition-all cursor-pointer flex items-center relative scroll-mt-16",
								selectedId === char.id
									? "bg-(--foreground)/10 border-(--foreground)/20"
									: "bg-transparent border-transparent hover:bg-foreground/5",
							)}
						>
							<Avatar className="size-14 mr-3">
								<AvatarImage src={char.avatar ?? undefined} />
								<AvatarFallback>{char.name}</AvatarFallback>
							</Avatar>

							<div className="flex-1 min-w-0 w-full">
								<h3 className="font-medium truncate">{char.name}</h3>
								<p className="text-xs opacity-50 truncate">
									{char.description}
								</p>
							</div>

							<div className="opacity-0 group-hover/character:opacity-100 flex flex-col">
								<Button
									size="icon-sm"
									variant="ghost"
									className="p-1 hover:text-blue-400 hover:bg-transparent!"
									onClick={(e) => {
										e.stopPropagation();
										setEditingCharacter(char);
									}}
								>
									<Edit2 size="16px" />
								</Button>
								<Button
									size="icon-sm"
									variant="ghost"
									onClick={(e) => {
										e.stopPropagation();
										setDeletingCharacter(char);
									}}
									className="p-1 hover:text-red-400 hover:bg-transparent!"
								>
									<Trash2 className="w-3 h-3" />
								</Button>
							</div>
						</div>
					))}
			</div>

			{deletingCharacter && (
				<ConfirmModal
					title="Delete"
					message={`Are you sure you want to delete ${deletingCharacter.name}?`}
					onConfirm={() => deleteCharacter(deletingCharacter.id)}
					open={!!deleteCharacter}
					onOpenChange={(open) => {
						if (!open) setDeletingCharacter(null);
					}}
				/>
			)}
			{editingCharacter && (
				<CharacterModal
					char={
						editingCharacter === "new"
							? {
									id: "",
									name: "",
									description: "",
									avatar: null,
									groupId: null,
								}
							: editingCharacter
					}
					onSave={editingCharacter === "new" ? addCharacter : updateCharacter}
					open={!!editingCharacter}
					onOpenChange={(open) => {
						if (!open) setEditingCharacter(null);
					}}
				/>
			)}
		</div>
	);
}
