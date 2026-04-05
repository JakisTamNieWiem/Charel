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

	const viewportRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	useEffect(() => {
		// Small timeout ensures the DOM has finished rendering the list
		const timer = setTimeout(() => {
			if (selectedId && viewportRef.current) {
				const element = itemRefs.current.get(selectedId);
				const viewport = viewportRef.current;

				if (element && viewport) {
					const elementTop = element.offsetTop;
					const elementBottom = elementTop + element.offsetHeight;
					const viewTop = viewport.scrollTop;
					const viewBottom = viewTop + viewport.clientHeight;

					// 1. If element is above the view
					if (elementBottom < viewTop) {
						viewport.scrollTo({ top: elementTop - 24, behavior: "smooth" });
					}
					// 2. If element is below the view
					else if (elementTop > viewBottom) {
						viewport.scrollTo({
							top: elementBottom - viewport.clientHeight - 12,
							behavior: "smooth",
						});
					}
				}
			}
		}, 50); // 50ms delay to wait for React render cycle

		return () => clearTimeout(timer);
	}, [selectedId]);

	return (
		<div>
			<div className="p-2 min-h-9 flex items-center justify-between sticky top-0 bg-sidebar z-50">
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
								"group/character px-3 py-2 rounded-lg border transition-all cursor-pointer flex items-center gap-3 relative",
								selectedId === char.id
									? "bg-white/10 border-white/20"
									: "bg-transparent border-transparent hover:bg-white/5",
							)}
						>
							<Avatar className="size-14">
								<AvatarImage src={char.avatar ?? undefined} />
								<AvatarFallback>{char.name}</AvatarFallback>
							</Avatar>

							<div className="flex-1 min-w-0">
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
