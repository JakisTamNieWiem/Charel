import { Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CharacterModal from "@/components/CharacterModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character } from "@/types/types";
import ConfirmModal from "../ConfirmModal";
import {
	SidebarEmptyState,
	SidebarSection,
	SidebarTabHeader,
	SidebarTabRoot,
	sidebarRowClass,
} from "./SidebarTabLayout";

export default function CharacterTab() {
	const allCharacters = useGraphStore((state) => state.characters);
	const addCharacter = useGraphStore((state) => state.addCharacter);
	const updateCharacter = useGraphStore((state) => state.updateCharacter);
	const deleteCharacter = useGraphStore((state) => state.deleteCharacter);
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);
	const [hoveredId, setHoveredId] = useState<string | null>(null);

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

	const sortedCharacters = [...allCharacters].sort((a, b) =>
		a.name.localeCompare(b.name),
	);

	return (
		<SidebarTabRoot>
			<SidebarTabHeader
				title="Characters"
				count={allCharacters.length}
				action={
					<Button
						onClick={() => setEditingCharacter("new")}
						variant="ghost"
						size="icon-sm"
						title="New character"
						className="hover:bg-(--sidebar-foreground)/8"
					>
						<Plus className="w-4 h-4" />
					</Button>
				}
			/>

			<SidebarSection>
				{sortedCharacters.length === 0 && (
					<SidebarEmptyState title="No characters yet">
						Add a character to begin mapping the cast.
					</SidebarEmptyState>
				)}

				<div className="space-y-2">
					{sortedCharacters.map((char) => (
						<div
							key={char.id}
							onMouseEnter={() => setHoveredId(char.id)}
							onMouseLeave={() => setHoveredId(null)}
							ref={(el) => {
								if (el) itemRefs.current.set(char.id, el);
								else itemRefs.current.delete(char.id);
							}}
							onClick={() => setSelectedCharId(char.id)}
							className={cn(
								sidebarRowClass,
								"group/character flex min-h-[4.75rem] cursor-pointer items-center gap-3 px-3 py-2.5 scroll-mt-16",
								selectedId === char.id
									? [
											"border-(--sidebar-primary)/20 bg-(--sidebar-primary)/8",
											"shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)]",
										]
									: "shadow-none",
							)}
						>
							<div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-(--sidebar-foreground)/12 bg-muted shadow-[0_0_0_3px_color-mix(in_oklab,var(--sidebar-foreground)_5%,transparent)]">
								{char.avatar ? (
									<img
										src={char.avatar}
										loading="lazy"
										className="h-full w-full object-cover pointer-events-none"
										alt=""
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center text-[0.6875rem] font-bold uppercase text-muted-foreground">
										{char.name.substring(0, 2)}
									</div>
								)}
							</div>

							<div className="min-w-0 flex-1">
								<h3 className="truncate text-sm font-semibold leading-snug">
									{char.name}
								</h3>
								<p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
									{char.description}
								</p>
							</div>

							{hoveredId === char.id && (
								<div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover/character:opacity-100">
									<Button
										size="icon-xs"
										variant="ghost"
										title="Edit character"
										className="hover:bg-(--sidebar-foreground)/8 hover:text-blue-400"
										onClick={(e) => {
											e.stopPropagation();
											setEditingCharacter(char);
										}}
									>
										<Edit2 className="size-4" />
									</Button>
									<Button
										size="icon-xs"
										variant="ghost"
										title="Delete character"
										onClick={(e) => {
											e.stopPropagation();
											setDeletingCharacter(char);
										}}
										className="hover:bg-(--sidebar-foreground)/8 hover:text-red-400"
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							)}
						</div>
					))}
				</div>
			</SidebarSection>

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
									ownerId: "",
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
		</SidebarTabRoot>
	);
}
