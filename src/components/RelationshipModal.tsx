import { useState } from "react";
import type { Character, Relationship, RelationshipType } from "@/types";
import { Button } from "./ui/button";
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
import { Textarea } from "./ui/textarea";

interface RelationshipModalProps {
	fromId: string;
	characters: Character[];
	initialData?: Relationship;
	types: RelationshipType[];
	onSave: (formData: Relationship) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function RelationshipModal({
	fromId,
	initialData,
	characters,
	types,
	onSave,
	open,
	onOpenChange,
}: RelationshipModalProps) {
	const [formData, setFormData] = useState(
		initialData || {
			fromId,
			toId: characters.find((c) => c.id !== fromId)?.id || "",
			typeId: types[0]?.id || "",
			description: "",
		},
	);

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
						<Select
							value={formData.toId}
							disabled={!!initialData}
							onValueChange={(value) =>
								setFormData({ ...formData, toId: value })
							}
						>
							<SelectTrigger className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30 appearance-none disabled:opacity-50">
								<SelectValue placeholder="Select a character" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Relationships</SelectLabel>

									{[...characters]
										.sort((a, b) => a.name.localeCompare(b.name))
										.map((c) => (
											<SelectItem
												key={c.id}
												value={c.id}
												className="bg-[#141414]"
											>
												{c.name}
											</SelectItem>
										))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field className="space-y-1">
						<Label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Type
						</Label>
						<Select
							value={formData.typeId}
							onValueChange={(value) =>
								setFormData({ ...formData, typeId: value })
							}
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
				</FieldGroup>
				<DialogFooter className="flex gap-3 pt-4">
					<DialogClose asChild>
						<Button
							variant={"secondary"}
							className="flex-1 p-3 border uppercase text-xs font-bold tracking-widest"
						>
							Cancel
						</Button>
					</DialogClose>
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
