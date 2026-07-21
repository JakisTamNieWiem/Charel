import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthProvider";
import { useProfile, useProfiles } from "@/hooks/useProfile";
import { processAvatarImage } from "@/lib/utils";
import type { Profile } from "@/types/chat";
import type { CharacterFormData } from "@/types/types";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Field, FieldDescription, FieldGroup } from "./ui/field";
import { Textarea } from "./ui/textarea";

interface CharacterModalProps {
	char: CharacterFormData;
	onSave: (char: CharacterFormData) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function getProfileLabel(profile: Profile) {
	const displayName = profile.displayName?.trim();
	if (displayName) return displayName;

	const role = profile.role === "dm" ? "DM" : "player";
	return `Unnamed ${role} · ${profile.userId.slice(0, 8)}`;
}

export default function CharacterModal({
	char,
	onSave,
	open,
	onOpenChange,
}: CharacterModalProps) {
	const { session } = useAuth();
	const { data: profile } = useProfile();
	const isNewCharacter = !char.id;
	const canChooseOwner = isNewCharacter && profile?.role === "dm";
	const {
		data: profiles = [],
		isPending: profilesPending,
		isError: profilesFailed,
	} = useProfiles(canChooseOwner);
	const [formData, setFormData] = useState<CharacterFormData>(() => ({
		...char,
		ownerId: char.ownerId || session?.user.id || "",
	}));
	const fileInputRef = useRef<HTMLInputElement>(null);
	const ownerOptions = useMemo(() => {
		const options = new Map(profiles.map((item) => [item.userId, item]));
		if (profile) options.set(profile.userId, profile);

		return [...options.values()].sort((a, b) => {
			if (a.userId === session?.user.id) return -1;
			if (b.userId === session?.user.id) return 1;
			return getProfileLabel(a).localeCompare(getProfileLabel(b));
		});
	}, [profile, profiles, session?.user.id]);
	const selectedOwner =
		ownerOptions.find((owner) => owner.userId === formData.ownerId) ?? null;

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
				<FieldGroup className="gap-4">
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
					{canChooseOwner && (
						<Field className="space-y-1">
							<Label
								htmlFor="character-owner"
								className="text-[10px] uppercase font-mono tracking-widest opacity-50"
							>
								Character Owner
							</Label>
							<Combobox
								items={ownerOptions}
								value={selectedOwner}
								onValueChange={(owner) => {
									if (owner) {
										setFormData((current) => ({
											...current,
											ownerId: owner.userId,
										}));
									}
								}}
								itemToStringLabel={getProfileLabel}
								itemToStringValue={getProfileLabel}
							>
								<ComboboxInput
									id="character-owner"
									placeholder="Select an owner"
									disabled={profilesPending || profilesFailed}
									className="w-full"
								/>
								<ComboboxContent>
									<ComboboxEmpty>No users found.</ComboboxEmpty>
									<ComboboxList>
										{(owner: Profile) => (
											<ComboboxItem key={owner.userId} value={owner}>
												<span className="min-w-0 flex-1 truncate">
													{getProfileLabel(owner)}
												</span>
												<Badge variant="secondary">
													{owner.role === "dm" ? "DM" : "Player"}
												</Badge>
											</ComboboxItem>
										)}
									</ComboboxList>
								</ComboboxContent>
							</Combobox>
							<FieldDescription className="text-xs">
								{profilesFailed
									? "Could not load other users. This character will belong to you."
									: "This user can edit the character and speak as them."}
							</FieldDescription>
						</Field>
					)}
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
				</FieldGroup>
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
