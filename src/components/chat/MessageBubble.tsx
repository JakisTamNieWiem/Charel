import { Check, Edit2, EllipsisVertical, Trash2, X } from "lucide-react";
import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { isImageContent } from "@/lib/chat-utils";
import type { Message } from "@/types/chat";
import type { Character } from "@/types/types";
import MessageContent from "./MessageContent";

interface MessageBubbleProps {
	msg: Message;
	characters: Character[];
	isEditing: boolean;
	editContent: string;
	onEditContentChange: (content: string) => void;
	onStartEdit: () => void;
	onConfirmEdit: () => void;
	onCancelEdit: () => void;
	onDelete: () => void;
}

export default function MessageBubble({
	msg,
	characters,
	isEditing,
	editContent,
	onEditContentChange,
	onStartEdit,
	onConfirmEdit,
	onCancelEdit,
	onDelete,
}: MessageBubbleProps) {
	const editRef = useRef<HTMLDivElement>(null);
	const char =
		msg.character || characters.find((c) => c.id === msg.characterId);
	const charName = char && "name" in char ? char.name : "Unknown";
	const charAvatar = char && "avatar" in char ? char.avatar : null;
	const isPending = msg._pending;

	return (
		<div
			className={`group/msg flex gap-3 py-1.5 ${isPending ? "opacity-50" : ""}`}
		>
			<Avatar className="size-11 shrink-0 mt-0.5">
				<AvatarImage src={charAvatar ?? undefined} />
				<AvatarFallback className="text-[10px]">{charName[0]}</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				<div className="flex items-baseline gap-2">
					<span className="text-md font-semibold">{charName}</span>
					{isPending ? (
						<span className="text-[10px] text-muted-foreground italic">
							sending...
						</span>
					) : (
						<span className="text-[10px] text-muted-foreground">
							{new Date(msg.created_at).toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					)}
					{msg.edited_at && (
						<span className="text-[9px] text-muted-foreground italic">
							(edited)
						</span>
					)}
				</div>
				{isEditing ? (
					<div ref={editRef} className="mt-1 space-y-2">
						<Textarea
							value={editContent}
							onChange={(e) => onEditContentChange(e.target.value)}
							className="text-sm min-h-[60px] bg-white/5"
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									onConfirmEdit();
								}
								if (e.key === "Escape") onCancelEdit();
							}}
							autoFocus
						/>
						<div className="flex gap-1">
							<Button size="sm" variant="ghost" onClick={onConfirmEdit}>
								<Check className="w-3 h-3 mr-1" /> Save
							</Button>
							<Button size="sm" variant="ghost" onClick={onCancelEdit}>
								<X className="w-3 h-3 mr-1" /> Cancel
							</Button>
						</div>
					</div>
				) : (
					<div className="mt-0.5">
						<MessageContent content={msg.content} />
					</div>
				)}
			</div>
			{!isEditing && !isPending && msg.userId && (
				<div className="opacity-0 group-hover/msg:opacity-100 shrink-0">
					<DropdownMenu>
						<DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1 text-foreground/60 hover:text-foreground hover:bg-white/10 transition-colors">
							<EllipsisVertical className="w-3.5 h-3.5" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{!isImageContent(msg.content) && (
								<DropdownMenuItem onClick={onStartEdit}>
									<Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
								</DropdownMenuItem>
							)}
							<DropdownMenuItem
								className="text-red-400 focus:text-red-400"
								onClick={onDelete}
							>
								<Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			)}
		</div>
	);
}
