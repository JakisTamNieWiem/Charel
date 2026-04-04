import { useEffect, useState } from "react";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, Relationship } from "@/types/types";
import { Button } from "./ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "./ui/combobox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Field, FieldGroup } from "./ui/field";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Textarea } from "./ui/textarea";

interface RelationshipModalProps {
	fromId: string;
	initialData?: Relationship;
	onSave: (formData: Relationship) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function RelationshipModal({
	fromId,
	initialData,
	onSave,
	open,
	onOpenChange,
}: RelationshipModalProps) {
	const characters = useGraphStore((state) => state.characters);
	const toCharacters = characters
		.filter((c) => c.id !== fromId)
		.sort((a, b) => a.name.localeCompare(b.name));
	const types = useGraphStore((state) => state.relationshipTypes);
	const [formData, setFormData] = useState(
		initialData || {
			fromId,
			toId: characters.find((c) => c.id !== fromId)?.id || "",
			typeId: types[0]?.id || "",
			description: "",
			value: null,
		},
	);
	useEffect(() => {
		if (open) {
			setFormData(
				initialData || {
					fromId,
					toId: characters.find((c) => c.id !== fromId)?.id || "",
					typeId: types[0]?.id || "",
					description: "",
					value: null, // (Optional) Resets your value slider
				},
			);
		}
	}, [open, fromId, initialData, characters, types]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="underline underline-offset-8">
						{initialData ? "Edit Relation" : "New Relation"}
					</DialogTitle>
				</DialogHeader>
				<FieldGroup className="space-y-4">
					<Field className="space-y-1">
						<Label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Target Character
						</Label>
						<Combobox
							value={
								toCharacters.find((c) => c.id === formData.toId)?.name ?? ""
							}
							onValueChange={(value) => {
								if (value) setFormData({ ...formData, toId: value });
								console.log(formData);
							}}
							items={toCharacters}
						>
							<ComboboxInput placeholder="Select a character" />
							<ComboboxContent>
								<ComboboxEmpty>No character found.</ComboboxEmpty>
								<ComboboxList>
									{(item: Character) => (
										<ComboboxItem key={item.id} value={item.id}>
											{item.name}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					</Field>
					<Field className="space-y-1">
						<Label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Type
						</Label>
						<Select
							items={types.map((t) => {
								return { label: t.label, value: t.id };
							})}
							value={formData.typeId}
							onValueChange={(value) => {
								if (value) setFormData({ ...formData, typeId: value });
							}}
						>
							<SelectTrigger className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30 appearance-none disabled:opacity-50">
								<SelectValue placeholder="Select a relationship" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Relationships</SelectLabel>

									{[...types]
										.sort((a, b) => a.label.localeCompare(b.label))
										.map((t) => (
											<SelectItem
												key={t.id}
												value={t.id}
												className="bg-[#141414]"
											>
												{t.label}
											</SelectItem>
										))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field className="space-y-1">
						<Label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Description
						</Label>
						<Textarea
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							placeholder="e.g. Secretly admires them"
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
						/>
					</Field>
					<Field className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
								Value Override
							</Label>
							{formData.value != null ? (
								<button
									type="button"
									onClick={() => setFormData({ ...formData, value: null })}
									className="text-[9px] font-mono opacity-40 hover:opacity-80 underline"
								>
									Reset to type default
								</button>
							) : (
								<span className="text-[9px] font-mono opacity-30">
									Using type default ({(() => {
										const t = types.find((t) => t.id === formData.typeId);
										const v = t?.value ?? 0;
										return (v > 0 ? "+" : "") + v.toFixed(2);
									})()})
								</span>
							)}
						</div>
						{formData.value != null ? (
							<>
								<div className="flex items-center justify-between">
									<span
										className="text-xs font-mono tabular-nums"
										style={{
											color:
												formData.value > 0
													? "#4ade80"
													: formData.value < 0
														? "#f87171"
														: "#808080",
										}}
									>
										{formData.value > 0 ? "+" : ""}
										{formData.value.toFixed(2)}
									</span>
								</div>
								<Slider
									min={-100}
									max={100}
									step={1}
									value={[Math.round(formData.value * 100)]}
									onValueChange={(v) => {
										setFormData({ ...formData, value: (v as number) / 100 });
									}}
								/>
							</>
						) : (
							<button
								type="button"
								onClick={() =>
									setFormData({
										...formData,
										value:
											types.find((t) => t.id === formData.typeId)?.value ?? 0,
									})
								}
								className="w-full p-2 rounded-lg border border-dashed border-white/10 text-[10px] opacity-40 hover:opacity-70 hover:border-white/20"
							>
								Click to set a custom value for this relationship
							</button>
						)}
						<div className="flex justify-between text-[9px] opacity-30 font-mono">
							<span>-1 Hostile</span>
							<span>0 Neutral</span>
							<span>+1 Close</span>
						</div>
					</Field>
				</FieldGroup>
				<DialogFooter className="flex gap-3 pt-4">
					<DialogClose
						render={
							<Button
								variant={"secondary"}
								className="flex-1 p-3 border uppercase text-xs font-bold tracking-widest"
							>
								Cancel
							</Button>
						}
					></DialogClose>
					<Button
						variant={"default"}
						onClick={() => {
							onSave(formData);
							onOpenChange(false);
						}}
						className="flex-1 p-3 uppercase text-xs font-bold tracking-widest"
					>
						{initialData ? "Save" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
