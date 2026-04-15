import { cn } from "@/lib/utils";
import {
	getCharacterStatusDotClass,
	type CharacterStatus,
} from "@/lib/character-status";
import {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";

interface CharacterAvatarProps {
	name: string;
	avatar: string | null | undefined;
	status: CharacterStatus;
	className?: string;
	fallbackClassName?: string;
	badgeClassName?: string;
}

export default function CharacterAvatar({
	name,
	avatar,
	status,
	className,
	fallbackClassName,
	badgeClassName,
}: CharacterAvatarProps) {
	return (
		<Avatar className={className}>
			<AvatarImage src={avatar ?? undefined} />
			<AvatarFallback className={fallbackClassName}>{name[0]}</AvatarFallback>
			<AvatarBadge
				className={cn(
					"ring-2 ring-background",
					getCharacterStatusDotClass(status),
					badgeClassName,
				)}
			/>
		</Avatar>
	);
}
