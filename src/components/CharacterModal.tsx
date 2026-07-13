import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { processAvatarImage } from "@/lib/utils";
import type { Character } from "@/types/types";
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
	char: Omit<Character, "ownerId">;
	onSave: (char: Omit<Character, "ownerId">) => void;
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
			const base64Avatar = await processAvatarImage(file);
			setFormData((prev) => ({ ...prev, avatar: base64Avatar }));
		} catch (error) {
			console.error("Failed to process image:", error);
			toast.error("Failed to process image.");
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
					<Field className="space-y-1">
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
					</Field>
					<Field className="space-y-1">
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
							className="w-full max-h-14 bg-white/5 border border-white/10 p-3 rounded-lg h-24 focus:outline-none focus:border-white/30"
						/>
					</Field>
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
							<Button
								type="button"
								variant="ghost"
								aria-label="Upload avatar"
								className="h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-white/20 p-0 transition-opacity hover:opacity-80"
								onClick={() => fileInputRef.current?.click()}
							>
								{formData.avatar ? (
									<img
										src={formData.avatar}
										alt=""
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full bg-white/10 flex items-center justify-center text-xs opacity-50 text-center">
										Click to upload
									</div>
								)}
							</Button>

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
					<DialogClose
						render={
							<Button
								variant={"secondary"}
								className="flex-1 rounded-lg border border-white/10 p-3 text-xs font-bold uppercase tracking-widest transition-colors"
							>
								Cancel
							</Button>
						}
					></DialogClose>
					<DialogClose
						render={
							<Button
								onClick={() => {
									onSave(formData);
								}}
								className="flex-1 rounded-lg p-3 text-xs font-bold uppercase tracking-widest transition-colors"
							>
								Save
							</Button>
						}
					></DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
