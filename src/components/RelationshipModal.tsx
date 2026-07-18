import { useRef, useState } from "react";
import {
	getRelationshipDescriptionColor,
	RELATIONSHIP_DESCRIPTION_COLORS,
	type RelationshipDescriptionColor,
	wrapRelationshipDescriptionSelection,
} from "@/lib/relationship-description";
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
import { Field, FieldDescription, FieldGroup } from "./ui/field";
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
	const relationships = useGraphStore((state) => state.relationships);
	const existingTargetIds = new Set(
		relationships
			.filter((relationship) => relationship.fromId === fromId)
			.map((relationship) => relationship.toId),
	);
	const toCharacters = characters
		.filter(
			(character) =>
				character.id !== fromId &&
				(Boolean(initialData) || !existingTargetIds.has(character.id)),
		)
		.sort((a, b) => a.name.localeCompare(b.name));
	const types = useGraphStore((state) => state.relationshipTypes);
	const descriptionRef = useRef<HTMLTextAreaElement>(null);
	const [formData, setFormData] = useState(
		() =>
			initialData || {
				fromId,
				toId: toCharacters[0]?.id ?? "",
				typeId: types[0]?.id || "",
				description: "",
				value: null,
			},
	);
	const applyDescriptionColor = (color: RelationshipDescriptionColor) => {
		const textarea = descriptionRef.current;
		if (!textarea) return;

		const result = wrapRelationshipDescriptionSelection(
			textarea.value,
			textarea.selectionStart,
			textarea.selectionEnd,
			color,
		);
		setFormData((current) => ({
			...current,
			description: result.value,
		}));
		requestAnimationFrame(() => {
			descriptionRef.current?.focus();
			descriptionRef.current?.setSelectionRange(
				result.selectionStart,
				result.selectionEnd,
			);
		});
	};
	const hasValidTarget = initialData
		? formData.toId === initialData.toId
		: toCharacters.some((character) => character.id === formData.toId);
	const canSave = hasValidTarget && Boolean(formData.typeId);

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
							}}
							items={toCharacters}
						>
							<ComboboxInput
								placeholder="Select a character"
								disabled={!!initialData}
							/>
							<ComboboxContent>
								<ComboboxEmpty>No available character found.</ComboboxEmpty>
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
						<Label
							htmlFor="relationship-description"
							className="text-[10px] uppercase font-mono tracking-widest opacity-50"
						>
							Description
						</Label>
						<Textarea
							ref={descriptionRef}
							id="relationship-description"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							placeholder="e.g. Secretly admires them"
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
						/>
						<div
							role="group"
							aria-label="Description text colors"
							className="grid w-fit grid-cols-8 gap-1.5"
						>
							{RELATIONSHIP_DESCRIPTION_COLORS.map((color) => (
								<Button
									key={color.name}
									type="button"
									variant="outline"
									size="icon-xs"
									aria-label={`Apply ${color.name} text color`}
									title={color.name}
									onClick={() => applyDescriptionColor(color.name)}
								>
									<span
										aria-hidden="true"
										className="size-3.5 rounded-full border border-foreground/15"
										style={{
											backgroundColor: getRelationshipDescriptionColor(
												color.name,
											),
										}}
									/>
								</Button>
							))}
						</div>
						<FieldDescription className="text-xs">
							Select text and choose a color, or type{" "}
							<code>[RED]text[/RED]</code>.
						</FieldDescription>
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
						disabled={!canSave}
						onClick={() => {
							onSave(formData);
							onOpenChange(false);
						}}
						className="flex-1 p-3 uppercase text-xs font-bold tracking-widest"
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
