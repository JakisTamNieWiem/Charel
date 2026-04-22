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
import { isImageContent, isSystemContent } from "@/lib/chat-utils";
import type { Message } from "@/types/chat";
import type { Character } from "@/types/types";
import MessageContent from "./MessageContent";

interface MessageBubbleProps {
	msg: Message;
	characters: Character[];
	isEditing: boolean;
	activeSpeakerId: string | null;
	displayName?: string;
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
	activeSpeakerId,
	displayName,
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
	const charName =
		displayName ?? (char && "name" in char ? char.name : "Unknown");
	const charAvatar = char && "avatar" in char ? char.avatar : null;
	const isPending = msg._pending;
	const isOwn = msg.characterId === activeSpeakerId;

	if (isSystemContent(msg.content)) {
		return (
			<div className="chat-system-message">
				<MessageContent content={msg.content} />
			</div>
		);
	}

	return (
		<div
			className={`chat-message group/msg ${isOwn ? "is-own" : ""} ${
				isPending ? "is-pending" : ""
			}`}
		>
			<Avatar className="chat-message-avatar">
				<AvatarImage src={charAvatar ?? undefined} />
				<AvatarFallback className="text-[10px]">{charName[0]}</AvatarFallback>
			</Avatar>
			<div className="chat-message-body">
				<div className="chat-message-meta">
					<span className="chat-message-name">{charName}</span>
					{isPending ? (
						<span className="chat-message-state">sending...</span>
					) : (
						<span className="chat-message-time">
							{new Date(msg.created_at).toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					)}
					{msg.edited_at && <span className="chat-message-state">edited</span>}
				</div>
				{isEditing ? (
					<div ref={editRef} className="chat-message-edit">
						<Textarea
							value={editContent}
							onChange={(e) => onEditContentChange(e.target.value)}
							className="chat-message-editarea"
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									onConfirmEdit();
								}
								if (e.key === "Escape") onCancelEdit();
							}}
							autoFocus
						/>
						<div className="chat-message-edit-actions">
							<Button size="sm" variant="ghost" onClick={onConfirmEdit}>
								<Check className="w-3 h-3 mr-1" /> Save
							</Button>
							<Button size="sm" variant="ghost" onClick={onCancelEdit}>
								<X className="w-3 h-3 mr-1" /> Cancel
							</Button>
						</div>
					</div>
				) : (
					<div className="chat-message-content">
						<MessageContent content={msg.content} />
					</div>
				)}
			</div>
			{!isEditing && !isPending && isOwn && (
				<div className="chat-message-actions">
					<DropdownMenu>
						<DropdownMenuTrigger className="chat-message-menu">
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
