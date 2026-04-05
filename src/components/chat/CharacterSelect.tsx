import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";

export default function CharacterSelect() {
	const characters = useGraphStore((s) => s.characters);
	const activeSpeakerId = useChatStore((s) => s.activeSpeakerId);
	const setActiveSpeakerId = useChatStore((s) => s.setActiveSpeakerId);

	if (characters.length === 0) return null;

	return (
		<div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar">
			<span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground shrink-0">
				Speaking as:
			</span>
			{characters.map((char) => (
				<button
					key={char.id}
					onClick={() => setActiveSpeakerId(char.id)}
					className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all shrink-0 ${
						activeSpeakerId === char.id
							? "bg-primary/20 text-primary ring-1 ring-primary/30"
							: "bg-white/5 text-muted-foreground hover:bg-white/10"
					}`}
				>
					<Avatar className="size-4">
						<AvatarImage src={char.avatar ?? undefined} />
						<AvatarFallback className="text-[6px]">
							{char.name[0]}
						</AvatarFallback>
					</Avatar>
					{char.name}
				</button>
			))}
		</div>
	);
}
