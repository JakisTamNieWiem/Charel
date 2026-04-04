import { Edit2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import TypeModal from "@/components/TypeModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGraphStore } from "@/store/useGraphStore";
import type { RelationshipType } from "@/types/types";

export default function RelationshipTypesTab() {
	const relationshipTypes = useGraphStore((state) => state.relationshipTypes);
	const deleteType = useGraphStore((state) => state.deleteType);

	const [editingType, setEditingType] = useState<RelationshipType | null>(null);

	return (
		<div className="flex flex-col h-full">
			<div className="px-4 flex items-center justify-between">
				<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
					Link Types
				</h2>
				<button
					onClick={() =>
						setEditingType({
							id: "",
							label: "",
							color: "",
							description: "",
							value: 0,
						})
					}
					className="p-1 hover:bg-white/10 rounded"
				>
					<Plus className="w-4 h-4" />
				</button>
			</div>
			<ScrollArea className="flex-1 px-4 h-full">
				<div className="space-y-2 py-4 pb-8">
					{relationshipTypes.map((type) => (
						<div
							key={type.id}
							style={{ "--hover-color": type.color } as React.CSSProperties}
							className="group px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3 transition-colors duration-200 hover:border-(--hover-color) hover:bg-(--hover-color)/10"
						>
							<div
								className="size-5 rounded-full"
								style={{ backgroundColor: type.color }}
							/>
							<div className="flex-1">
								<h3 className="text-sm font-medium">{type.label}</h3>
								<p className="text-[10px] opacity-50">{type.description}</p>
							</div>
							<div className="justify-end">
								<p
									style={{
										color: sentimentColor(type.value),
									}}
									className="text-xs text-left "
								>
									{type.value >= 0 ? "+" : ""}
									{type.value?.toFixed(2)}
								</p>
							</div>
							<div className="flex flex-col gap-1">
								<button
									onClick={() => setEditingType(type)}
									className="p-1 hover:text-blue-400"
								>
									<Edit2 className="w-3 h-3" />
								</button>
								<button
									onClick={() => deleteType(type.id)}
									className="p-1 hover:text-red-400"
								>
									<Trash2 className="w-3 h-3" />
								</button>
							</div>
						</div>
					))}
				</div>
			</ScrollArea>
			{editingType && (
				<TypeModal
					type={editingType}
					open={!!editingType}
					onOpenChange={(open) => {
						if (!open) setEditingType(null);
					}}
				/>
			)}
		</div>
	);
}

function lerp(start: number, end: number, amt: number) {
	return (1 - amt) * start + amt * end;
}

function sentimentColor(value: number) {
	// 1. Clamp value to range [-1, 1] to prevent color overflow
	const clamped = Math.max(-1, Math.min(1, value));

	// 2. Define our anchor points (RGB values)
	const red = { r: 248, g: 113, b: 113 }; // #f87171
	const grey = { r: 128, g: 128, b: 128 }; // #808080
	const green = { r: 74, g: 222, b: 128 }; // #4ade80

	let start: typeof red;
	let end: typeof red;
	let t: number;

	if (clamped < 0) {
		// Moving from Red to Grey (clamped is -1 to 0)
		start = red;
		end = grey;
		t = 1 + clamped; // Inverts -1..0 to 0..1
	} else {
		// Moving from Grey to Green (clamped is 0 to 1)
		start = grey;
		end = green;
		t = clamped; // 0..1
	}

	const r = Math.round(lerp(start.r, end.r, t));
	const g = Math.round(lerp(start.g, end.g, t));
	const b = Math.round(lerp(start.b, end.b, t));

	return `rgb(${r}, ${g}, ${b})`;
}
