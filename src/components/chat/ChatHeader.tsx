import {
	EllipsisVertical,
	Pencil,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatMember } from "@/types/chat";

interface ChatHeaderProps {
	headerName: string;
	isGroup: boolean;
	chatId: string | null;
	members: ChatMember[];
	onShowMembers: () => void;
	onShowAddMembers: () => void;
	onShowRename: (currentName: string) => void;
	onDelete: () => void;
}

export default function ChatHeader({
	headerName,
	isGroup,
	chatId,
	members,
	onShowMembers,
	onShowAddMembers,
	onShowRename,
	onDelete,
}: ChatHeaderProps) {
	return (
		<div className="shrink-0 px-6 py-3 border-b border-white/10 bg-background/60 backdrop-blur-md flex items-center justify-between">
			<h2 className="font-semibold truncate">{headerName}</h2>
			{isGroup && chatId && (
				<DropdownMenu>
					<DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1 text-foreground/60 hover:text-foreground hover:bg-white/10 transition-colors">
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
						<DropdownMenuItem
							className="text-red-400 focus:text-red-400"
							onClick={onDelete}
						>
							<Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Chat
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
