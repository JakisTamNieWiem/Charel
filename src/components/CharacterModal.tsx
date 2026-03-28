import { Edit2, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "#/components//ui/input";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import type { Character } from "#/types";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";

interface CharacterModalProps {
	char: Character;
	onSave: (char: Character) => void;
}

export default function CharacterModal({ char, onSave }: CharacterModalProps) {
	const [open, setOpen] = useState(false);
	const [formData, setFormData] = useState(char);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{char.id ? (
				<DialogTrigger asChild>
					<Button
						size="icon-sm"
						variant="ghost"
						className="p-1 hover:text-blue-400 hover:bg-transparent!"
					>
						<Edit2 size="16px" />
					</Button>
				</DialogTrigger>
			) : (
				<DialogTrigger asChild>
					<Button variant="ghost" className="">
						<Plus className="w-4 h-4" />
					</Button>
				</DialogTrigger>
			)}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{char.id ? "Edit Character" : "New Character"}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1">
						<Label
							htmlFor="name"
							className="text-[10px] uppercase font-mono tracking-widest opacity-50"
						>
							Name
						</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
						/>
					</div>
					<div className="space-y-1">
						<Label
							htmlFor="description"
							className="text-[10px] uppercase font-mono tracking-widest opacity-50"
						>
							Description
						</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg h-24 focus:outline-none focus:border-white/30"
						/>
					</div>
					<div className="space-y-1">
						<Label
							htmlFor="avatar"
							className="text-[10px] uppercase font-mono tracking-widest opacity-50"
						>
							Avatar URL
						</Label>
						<Input
							id="avatar"
							value={formData.avatar}
							onChange={(e) =>
								setFormData({ ...formData, avatar: e.target.value })
							}
							placeholder="https://..."
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
						/>
					</div>
				</div>
				<DialogFooter>
					<div className="flex gap-3 pt-4">
						<DialogClose asChild>
							<Button
								variant={"secondary"}
								className="flex-1 p-3 border border-white/10 rounded-lgtransition-colors uppercase text-xs font-bold tracking-widest"
							>
								Cancel
							</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button
								onClick={() => {
									onSave(formData);
								}}
								className="flex-1 p-3rounded-lgtransition-colors uppercase text-xs font-bold tracking-widest"
							>
								Save
							</Button>
						</DialogClose>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
