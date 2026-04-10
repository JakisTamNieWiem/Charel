import { ImagePlus, UserMinus, X } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { readFileAsDataURL, resizeImage } from "@/lib/chat-utils";
import type { ChatMember } from "@/types/chat";
import type { Character } from "@/types/types";

interface MembersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	members: ChatMember[];
	characters: Character[];
	activeSpeakerId: string | null;
	onRemoveMember: (characterId: string) => void;
}

export function MembersDialog({
	open,
	onOpenChange,
	members,
	characters,
	activeSpeakerId,
	onRemoveMember,
}: MembersDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Members</DialogTitle>
				</DialogHeader>
				<div className="space-y-1 max-h-64 overflow-y-auto">
					{members.map((m) => {
						const char = characters.find((c) => c.id === m.characterId);
						if (!char) return null;
						return (
							<div
								key={m.characterId}
								className="flex items-center gap-2 px-2 py-1.5 rounded-md group/member hover:bg-white/5"
							>
								<Avatar className="size-8">
									<AvatarImage src={char.avatar ?? undefined} />
									<AvatarFallback className="text-[10px]">
										{char.name[0]}
									</AvatarFallback>
								</Avatar>
								<span className="text-sm flex-1">{char.name}</span>
								{m.characterId !== activeSpeakerId && (
									<Button
										size="icon-sm"
										variant="ghost"
										className="opacity-0 group-hover/member:opacity-100 p-1 hover:text-red-400 hover:bg-transparent!"
										onClick={() => onRemoveMember(m.characterId)}
										title="Remove member"
									>
										<UserMinus className="w-3 h-3" />
									</Button>
								)}
							</div>
						);
					})}
					{members.length === 0 && (
						<p className="text-sm text-muted-foreground text-center py-4">
							No members
						</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

interface RenameDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRename: (name: string) => void;
	initialName: string;
}

export function RenameDialog({
	open,
	onOpenChange,
	onRename,
	initialName,
}: RenameDialogProps) {
	const [name, setName] = useState(initialName);
	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				onOpenChange(v);
				if (v) setName(initialName);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename Group Chat</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Group name"
						className="text-sm"
						onKeyDown={(e) => {
							if (e.key === "Enter" && name.trim()) {
								onRename(name.trim());
								onOpenChange(false);
							}
						}}
						autoFocus
					/>
					<Button
						onClick={() => {
							if (name.trim()) {
								onRename(name.trim());
								onOpenChange(false);
							}
						}}
						disabled={!name.trim()}
						className="w-full"
					>
						Save
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

interface AddMembersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	characters: Character[];
	existingMemberIds: string[];
	excludeId: string | null;
	onAdd: (characterIds: string[]) => void;
}

export function AddMembersDialog({
	open,
	onOpenChange,
	characters,
	existingMemberIds,
	excludeId,
	onAdd,
}: AddMembersDialogProps) {
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<string[]>([]);

	const handleOpen = (v: boolean) => {
		onOpenChange(v);
		if (v) {
			setSearch("");
			setSelected([]);
		}
	};

	const filtered = characters.filter((c) => {
		if (existingMemberIds.includes(c.id) || selected.includes(c.id))
			return false;
		if (c.id === excludeId) return false;
		if (search) return c.name.toLowerCase().includes(search.toLowerCase());
		return true;
	});

	return (
		<Dialog open={open} onOpenChange={handleOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Members</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<Input
						placeholder="Search characters..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-7 text-xs"
					/>
					{selected.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{selected.map((id) => {
								const char = characters.find((c) => c.id === id);
								if (!char) return null;
								return (
									<span
										key={id}
										className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs"
									>
										{char.name}
										<X
											className="w-3 h-3 cursor-pointer hover:text-red-400"
											onClick={() =>
												setSelected((p) => p.filter((cid) => cid !== id))
											}
										/>
									</span>
								);
							})}
						</div>
					)}
					<div className="max-h-48 overflow-y-auto space-y-1">
						{filtered.map((char) => (
							<div
								key={char.id}
								onClick={() => setSelected((p) => [...p, char.id])}
								className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-white/5 transition-colors"
							>
								<Avatar className="size-6">
									<AvatarImage src={char.avatar ?? undefined} />
									<AvatarFallback className="text-[8px]">
										{char.name[0]}
									</AvatarFallback>
								</Avatar>
								<span className="text-sm truncate">{char.name}</span>
							</div>
						))}
					</div>
					<Button
						onClick={() => {
							onAdd(selected);
							handleOpen(false);
						}}
						disabled={selected.length === 0}
						className="w-full"
					>
						Add Members
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

interface ChangeCoverDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentCover: string | null;
	onSave: (cover: string) => void;
}

export function ChangeCoverDialog({
	open,
	onOpenChange,
	currentCover,
	onSave,
}: ChangeCoverDialogProps) {
	const [preview, setPreview] = useState<string | null>(null);

	const handleSelect = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			const dataUrl =
				file.type === "image/gif"
					? await readFileAsDataURL(file)
					: await resizeImage(file);
			setPreview(dataUrl);
		};
		input.click();
	};

	const displayed = preview ?? currentCover;

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				onOpenChange(v);
				if (!v) setPreview(null);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Change Group Photo</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col items-center gap-4 py-2">
					<button
						onClick={handleSelect}
						className="relative w-28 h-28 rounded-full overflow-hidden bg-white/10 flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
					>
						{displayed ? (
							<img
								src={displayed}
								alt="Cover"
								className="w-full h-full object-cover"
							/>
						) : (
							<ImagePlus className="w-8 h-8 text-muted-foreground" />
						)}
					</button>
					<Button variant="outline" size="sm" onClick={handleSelect}>
						Choose Photo
					</Button>
					<Button
						className="w-full"
						disabled={!preview}
						onClick={() => {
							if (preview) {
								onSave(preview);
								onOpenChange(false);
							}
						}}
					>
						Save
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
