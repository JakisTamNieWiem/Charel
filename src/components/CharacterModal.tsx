import { useRef, useState } from "react";
import { Input } from "@/components//ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { processAvatarImage } from "@/lib/utils";
import type { Character } from "@/types";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Field } from "./ui/field";
import { Textarea } from "./ui/textarea";

interface CharacterModalProps {
	char: Character;
	onSave: (char: Character) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function CharacterModal({
	char,
	onSave,
	open,
	onOpenChange,
}: CharacterModalProps) {
	const [formData, setFormData] = useState(char);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			// Process the image
			const base64Avatar = await processAvatarImage(file);

			// Update your state with the new base64 string
			setFormData((prev) => ({ ...prev, avatar: base64Avatar }));
		} catch (error) {
			console.error("Failed to process image:", error);
			alert("Failed to process image.");
		}
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="underline underline-offset-8">
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
					<div className="space-y-1 space-x-2 flex items-center">
						<Field className="self-start mt-1">
							<Label
								htmlFor="avatar-url"
								className="text-[10px] uppercase font-mono tracking-widest opacity-50"
							>
								Avatar URL
							</Label>
							<Input
								id="avatar-url"
								value={formData.avatar ?? ""}
								onChange={(e) =>
									setFormData({ ...formData, avatar: e.target.value })
								}
								placeholder="https://..."
								className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
							/>
						</Field>
						<div className="text-center text-white/50 mt-1">OR</div>
						<div>
							{/* Preview the Avatar */}
							<div
								className="w-24 h-24 rounded-full border border-white/20 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
								onClick={() => fileInputRef.current?.click()} // Clicking the image opens the file picker
							>
								{formData.avatar ? (
									<img
										src={formData.avatar}
										alt="Avatar"
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full bg-white/10 flex items-center justify-center text-xs opacity-50 text-center">
										Click to upload
									</div>
								)}
							</div>

							{/* The Hidden File Input */}
							<input
								type="file"
								accept="image/png, image/jpeg, image/webp"
								className="hidden"
								ref={fileInputRef}
								onChange={handleImageUpload}
							/>
						</div>
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
