import {
	EllipsisVertical,
	ImagePlus,
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
import {
	getCharacterStatusBadgeClass,
	getCharacterStatusLabel,
	type CharacterStatus,
} from "@/lib/character-status";
import { cn } from "@/lib/utils";
import type { ChatMember } from "@/types/chat";

interface ChatHeaderProps {
	headerName: string;
	isGroup: boolean;
	chatId: string | null;
	members: ChatMember[];
	directStatus?: CharacterStatus | null;
	onShowMembers: () => void;
	onShowAddMembers: () => void;
	onShowRename: (currentName: string) => void;
	onShowChangeCover: () => void;
	onDelete: () => void;
}

export default function ChatHeader({
	headerName,
	isGroup,
	chatId,
	members,
	directStatus,
	onShowMembers,
	onShowAddMembers,
	onShowRename,
	onShowChangeCover,
	onDelete,
}: ChatHeaderProps) {
	return (
		<div className="shrink-0 px-6 py-3 border-b border-white/10 bg-background/60 backdrop-blur-md flex items-center justify-between">
			<div className="min-w-0">
				<h2 className="font-semibold truncate">{headerName}</h2>
				{!isGroup && directStatus && (
					<div className="mt-1 flex items-center gap-2">
						<span
							className={cn(
								"rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]",
								getCharacterStatusBadgeClass(directStatus),
							)}
						>
							{getCharacterStatusLabel(directStatus)}
						</span>
					</div>
				)}
			</div>
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
		</div>
	);
}
