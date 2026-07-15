import type { Group, RelationshipType } from "@/types/types";
import { Badge } from "./ui/badge";

type NetworkGraphOverlayProps = {
	groups: Group[];
	types: RelationshipType[];
	showGroups: boolean;
};

export default function NetworkGraphOverlay({
	groups,
	types,
	showGroups,
}: NetworkGraphOverlayProps) {
	return (
		<>
			{showGroups && (
				<div className="pointer-events-none absolute top-6 left-6 z-10 flex flex-col gap-2">
					{groups.map((group) => (
						<div
							key={group.id}
							className="flex cursor-default items-center gap-2 rounded-full border border-foreground/5 bg-card/40 px-3 py-1.5 backdrop-blur-md transition-all hover:bg-foreground/10 pointer-events-auto"
						>
							<div
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: group.color }}
							/>
							<span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
								{group.name}
							</span>
						</div>
					))}
				</div>
			)}

			<div className="pointer-events-none z-10 flex w-min flex-col flex-wrap-reverse gap-3 p-6">
				{types.map((type) => (
					<Badge
						variant="secondary"
						key={type.id}
						className="self-start border border-foreground/5 bg-card/40 p-2.5 pr-1 backdrop-blur-md transition-all hover:bg-foreground/10 pointer-events-auto"
					>
						<span className="text-[10px] font-bold uppercase tracking-widest">
							{type.label}
						</span>
						<div
							className="ml-2 h-3 w-3 rounded-full"
							style={{ backgroundColor: type.color }}
						/>
					</Badge>
				))}
			</div>
		</>
	);
}
