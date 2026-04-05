import { useEffect, useState } from "react";
import { useGraphStore } from "@/store/useGraphStore";
import type { RelationshipType } from "@/types/types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Slider } from "./ui/slider";

interface TypeModalProps {
	type: RelationshipType;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function TypeModal({
	type,
	open,
	onOpenChange,
}: TypeModalProps) {
	const addType = useGraphStore((state) => state.addType);
	const updateType = useGraphStore((state) => state.updateType);
	const [formData, setFormData] = useState(type);

	useEffect(() => {
		setFormData(type);
	}, [type]);

	const isEditing = !!type.id;

	const handleSave = () => {
		if (!formData.value) formData.value = 0;
		if (isEditing) {
			updateType(formData);
		} else {
			addType(formData);
		}
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="underline underline-offset-8">
						{type.id ? "Edit Type" : "New Type"}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Label
						</label>
						<input
							value={formData.label}
							onChange={(e) =>
								setFormData({ ...formData, label: e.target.value })
							}
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
						/>
					</div>
					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Color
						</label>
						<div className="flex gap-3">
							<input
								type="color"
								value={formData.color}
								onChange={(e) =>
									setFormData({ ...formData, color: e.target.value })
								}
								className="w-12 h-12 bg-transparent border-none cursor-pointer"
							/>
							<input
								value={formData.color}
								onChange={(e) =>
									setFormData({ ...formData, color: e.target.value })
								}
								className="flex-1 bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
							/>
						</div>
					</div>
					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Description
						</label>
						<textarea
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg h-24 focus:outline-none focus:border-white/30"
						/>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
								Relationship Strength
							</label>
							<span
								className="text-xs font-mono tabular-nums"
								style={{
									color:
										(formData.value ?? 0) > 0
											? "#4ade80"
											: (formData.value ?? 0) < 0
												? "#f87171"
												: "#808080",
								}}
							>
								{(formData.value ?? 0) > 0 ? "+" : ""}
								{(formData.value ?? 0).toFixed(2)}
							</span>
						</div>
						<Slider
							min={-100}
							max={100}
							defaultValue={[0]}
							step={1}
							value={[Math.round((formData.value ?? 0) * 100)]}
							onValueChange={(val: number | readonly number[]) => {
								const v = Array.isArray(val) ? val[0] : val;
								setFormData({ ...formData, value: v / 100 });
							}}
						/>
						<div className="flex justify-between text-[9px] opacity-30 font-mono">
							<span>-1 Hostile</span>
							<span>0 Neutral</span>
							<span>+1 Close</span>
						</div>
					</div>
				</div>
				<div className="flex gap-3 pt-4">
					<Button
						onClick={() => onOpenChange(false)}
						className="flex-1 p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors uppercase text-xs font-bold tracking-widest"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						className="flex-1 p-3 bg-white text-black rounded-lg hover:bg-white/90 transition-colors uppercase text-xs font-bold tracking-widest"
					>
						Save
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
