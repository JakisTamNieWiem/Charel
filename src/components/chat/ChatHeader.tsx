import {
	EllipsisVertical,
	ImagePlus,
	Pencil,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatMember } from "@/types/chat";

interface ChatHeaderProps {
	headerName: string;
	subtitle: string;
	avatarUrl?: string | null;
	isGroup: boolean;
	chatId: string | null;
	members: ChatMember[];
	onShowMembers: () => void;
	onShowAddMembers: () => void;
	onShowRename: (currentName: string) => void;
	onShowChangeCover: () => void;
	onDelete: () => void;
}

export default function ChatHeader({
	headerName,
	subtitle,
	avatarUrl,
	isGroup,
	chatId,
	members,
	onShowMembers,
	onShowAddMembers,
	onShowRename,
	onShowChangeCover,
	onDelete,
}: ChatHeaderProps) {
	return (
		<header className="chat-header">
			<div className="chat-header-identity">
				<Avatar className="chat-header-avatar">
					<AvatarImage src={avatarUrl ?? undefined} />
					<AvatarFallback>
						{isGroup ? (
							<Users className="size-4" />
						) : (
							headerName[0]?.toUpperCase()
						)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<h2>{headerName}</h2>
					<p>{subtitle}</p>
				</div>
			</div>
			{isGroup && chatId && (
				<DropdownMenu>
					<DropdownMenuTrigger className="chat-header-menu">
						<EllipsisVertical className="w-4 h-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-[180px]">
						<DropdownMenuItem onClick={onShowMembers}>
							<Users className="w-3.5 h-3.5 mr-2" /> View Members (
							{members.length})
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onShowAddMembers}>
							<UserPlus className="w-3.5 h-3.5 mr-2" /> Add Members
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onShowRename(headerName)}>
							<Pencil className="w-3.5 h-3.5 mr-2" /> Rename Chat
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onShowChangeCover}>
							<ImagePlus className="w-3.5 h-3.5 mr-2" /> Change Cover
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-red-400 focus:text-red-400"
							onClick={onDelete}
						>
							<Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Chat
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</header>
	);
}
