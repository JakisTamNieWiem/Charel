import { Edit2, Plus, Shuffle, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import TypeModal from "@/components/TypeModal";
import { Button } from "@/components/ui/button";
import { useGraphStore } from "@/store/useGraphStore";
import type { RelationshipType } from "@/types/types";
import {
	SidebarEmptyState,
	SidebarTabHeader,
	SidebarTabRoot,
	sidebarRowClass,
} from "./SidebarTabLayout";

export default function RelationshipTypesTab() {
	const relationshipTypes = useGraphStore((state) => state.relationshipTypes);
	const relationships = useGraphStore((state) => state.relationships);
	const characters = useGraphStore((state) => state.characters);
	const selectedTypeId = useGraphStore((state) => state.linkViewTypeId);
	const deleteType = useGraphStore((state) => state.deleteType);
	const setLinkViewSelection = useGraphStore(
		(state) => state.setLinkViewSelection,
	);
	const randomizeLinkView = useGraphStore((state) => state.randomizeLinkView);

	const [editingType, setEditingType] = useState<RelationshipType | null>(null);
	const characterIds = new Set(characters.map((character) => character.id));
	const activeTypeId = selectedTypeId ?? relationshipTypes[0]?.id ?? null;
	const hasPreviewRelationship = relationships.some(
		(relationship) =>
			relationship.typeId === activeTypeId &&
			characterIds.has(relationship.fromId) &&
			characterIds.has(relationship.toId),
	);
	const selectLinkType = (typeId: string) => {
		const relationship = relationships.find(
			(candidate) =>
				candidate.typeId === typeId &&
				characterIds.has(candidate.fromId) &&
				characterIds.has(candidate.toId),
		);

		setLinkViewSelection({
			typeId,
			sourceId: relationship?.fromId ?? null,
			targetId: relationship?.toId ?? null,
		});
	};

	useEffect(() => {
		if (!selectedTypeId && relationshipTypes[0]) {
			setLinkViewSelection({ typeId: relationshipTypes[0].id });
		}
	}, [relationshipTypes, selectedTypeId, setLinkViewSelection]);

	return (
		<SidebarTabRoot>
			<SidebarTabHeader
				title="Link Types"
				count={relationshipTypes.length}
				action={
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon-sm"
							title="Shuffle preview characters"
							disabled={!hasPreviewRelationship}
							onClick={randomizeLinkView}
							className="hover:bg-(--sidebar-foreground)/8"
						>
							<Shuffle className="w-4 h-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							title="New link type"
							onClick={() =>
								setEditingType({
									id: "",
									label: "",
									color: "",
									description: "",
									value: 0,
								})
							}
							className="hover:bg-(--sidebar-foreground)/8"
						>
							<Plus className="w-4 h-4" />
						</Button>
					</div>
				}
			/>

			<div className="space-y-1.5">
				{relationshipTypes.length === 0 && (
					<SidebarEmptyState title="No link types yet">
						Add relationship types to describe how characters connect.
					</SidebarEmptyState>
				)}

				{relationshipTypes.map((type) => (
					<div
						key={type.id}
						style={{ "--hover-color": type.color } as CSSProperties}
						onClick={() => selectLinkType(type.id)}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								selectLinkType(type.id);
							}
						}}
						role="button"
						tabIndex={0}
						className={`${sidebarRowClass} group flex min-h-[3.75rem] cursor-pointer items-center gap-3 px-3 py-2 hover:border-(--hover-color) hover:bg-(--hover-color)/10 ${
							selectedTypeId === type.id
								? "border-(--hover-color) bg-(--hover-color)/12"
								: ""
						}`}
					>
						<div
							className="size-7 shrink-0 rounded-full"
							style={{ backgroundColor: type.color }}
						/>
						<div className="min-w-0 flex-1">
							<h3 className="truncate text-sm font-semibold leading-snug">
								{type.label}
							</h3>
							<p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
								{type.description}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<span
								style={{
									color: sentimentColor(type.value),
								}}
								className="min-w-10 text-right text-xs font-mono font-bold tabular-nums"
							>
								{type.value >= 0 ? "+" : ""}
								{type.value?.toFixed(2)}
							</span>
							<div className="flex flex-col gap-0.5 opacity-55 transition-opacity group-hover:opacity-100">
								<Button
									variant="ghost"
									size="icon-xs"
									title="Edit link type"
									onClick={(event) => {
										event.stopPropagation();
										setEditingType(type);
									}}
									className="hover:bg-(--sidebar-foreground)/8 hover:text-blue-400"
								>
									<Edit2 className="w-3 h-3" />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									title="Delete link type"
									onClick={(event) => {
										event.stopPropagation();
										deleteType(type.id);
									}}
									className="hover:bg-(--sidebar-foreground)/8 hover:text-red-400"
								>
									<Trash2 className="w-3 h-3" />
								</Button>
							</div>
						</div>
					</div>
				))}
			</div>

			{editingType && (
				<TypeModal
					type={editingType}
					open={!!editingType}
					onOpenChange={(open) => {
						if (!open) setEditingType(null);
					}}
				/>
			)}
		</SidebarTabRoot>
	);
}

function lerp(start: number, end: number, amt: number) {
	return (1 - amt) * start + amt * end;
}

function sentimentColor(value: number) {
	const clamped = Math.max(-1, Math.min(1, value));

	const red = { r: 248, g: 113, b: 113 };
	const grey = { r: 128, g: 128, b: 128 };
	const green = { r: 74, g: 222, b: 128 };

	let start: typeof red;
	let end: typeof red;
	let t: number;

	if (clamped < 0) {
		start = red;
		end = grey;
		t = 1 + clamped;
	} else {
		start = grey;
		end = green;
		t = clamped;
	}

	const r = Math.round(lerp(start.r, end.r, t));
	const g = Math.round(lerp(start.g, end.g, t));
	const b = Math.round(lerp(start.b, end.b, t));

	return `rgb(${r}, ${g}, ${b})`;
}
