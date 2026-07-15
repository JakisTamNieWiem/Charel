import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRelationshipHistory } from "@/hooks/useRelationshipVersions";

type RelationshipHistoryDialogProps = {
	fromName: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	relationshipId: string | undefined;
	toName: string;
};

function getChangeLabel(changeKind: string) {
	if (changeKind === "created") return "Created";
	if (changeKind === "baseline") return "Tracking started";
	return "Updated";
}

function formatStrength(value: number) {
	return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

export default function RelationshipHistoryDialog({
	fromName,
	onOpenChange,
	open,
	relationshipId,
	toName,
}: RelationshipHistoryDialogProps) {
	const {
		data: versions = [],
		error,
		isPending,
	} = useRelationshipHistory(relationshipId);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="grid max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Relationship history</DialogTitle>
					<DialogDescription>
						{fromName} to {toName}, newest change first.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="h-[min(32rem,calc(100vh-10rem))] min-h-0 pr-4">
					{isPending && (
						<p className="py-8 text-center text-muted-foreground">
							Loading history…
						</p>
					)}
					{error && (
						<p className="py-8 text-center text-destructive" role="alert">
							Could not load relationship history.
						</p>
					)}
					{!isPending && !error && versions.length === 0 && (
						<p className="py-8 text-center text-muted-foreground">
							No history is available for this relationship.
						</p>
					)}

					<div className="space-y-3">
						{versions.map((version, index) => (
							<article
								key={version.id}
								className="rounded-lg border border-foreground/10 bg-foreground/3 p-4"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<Badge variant={index === 0 ? "default" : "outline"}>
											{index === 0
												? "Current"
												: getChangeLabel(version.change_kind)}
										</Badge>
										{index === 0 && (
											<span className="text-xs text-muted-foreground">
												{getChangeLabel(version.change_kind)}
											</span>
										)}
									</div>
									<time
										className="text-xs text-muted-foreground"
										dateTime={version.changed_at}
									>
										{format(new Date(version.changed_at), "PPp")}
									</time>
								</div>

								<div className="mt-3 flex items-baseline justify-between gap-3">
									<strong className="text-sm">{version.type_label}</strong>
									<span className="font-mono text-sm font-semibold tabular-nums">
										{formatStrength(version.effective_value)}
									</span>
								</div>
								<p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-foreground/80">
									{version.description || "No relationship note."}
								</p>
							</article>
						))}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
