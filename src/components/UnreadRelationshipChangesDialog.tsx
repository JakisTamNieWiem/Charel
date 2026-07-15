import { ArrowRight, Check } from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	type UnreadRelationshipVersion,
	useMarkRelationshipVersionsRead,
} from "@/hooks/useRelationshipVersions";
import { useGraphStore } from "@/store/useGraphStore";

type UnreadRelationshipChangesDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	unreadVersions: UnreadRelationshipVersion[];
};

export default function UnreadRelationshipChangesDialog({
	open,
	onOpenChange,
	unreadVersions,
}: UnreadRelationshipChangesDialogProps) {
	const characters = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const relationshipTypes = useGraphStore((state) => state.relationshipTypes);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);
	const markVersionsRead = useMarkRelationshipVersionsRead();

	const changes = useMemo(
		() =>
			unreadVersions.flatMap((unread) => {
				const relationship = relationships.find(
					(current) => current.id === unread.relationship_id,
				);
				if (!relationship) return [];

				const fromCharacter = characters.find(
					(character) => character.id === relationship.fromId,
				);
				const toCharacter = characters.find(
					(character) => character.id === relationship.toId,
				);
				const relationshipType = relationshipTypes.find(
					(type) => type.id === relationship.typeId,
				);

				return [
					{
						...unread,
						description: relationship.description,
						fromCharacter,
						toCharacter,
						typeLabel: relationshipType?.label ?? "Relationship",
					},
				];
			}),
		[characters, relationships, relationshipTypes, unreadVersions],
	);
	const unreadCount = unreadVersions.reduce(
		(total, version) => total + version.unread_count,
		0,
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="grid max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Unread relationship changes</DialogTitle>
					<DialogDescription>
						{unreadCount} unread {unreadCount === 1 ? "change" : "changes"}
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="min-h-0 max-h-[32rem] pr-3">
					{changes.length === 0 ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							You are all caught up.
						</p>
					) : (
						<ItemGroup>
							{changes.map((change) => (
								<Item key={change.relationship_id} variant="outline" size="sm">
									<ItemMedia>
										<Avatar>
											{change.toCharacter?.avatar && (
												<AvatarImage src={change.toCharacter.avatar} alt="" />
											)}
											<AvatarFallback>
												{change.toCharacter?.name.substring(0, 2) ?? "?"}
											</AvatarFallback>
										</Avatar>
									</ItemMedia>

									<ItemContent className="min-w-0">
										<ItemTitle className="flex-wrap">
											<span>
												{change.fromCharacter?.name ?? "Unknown"} →{" "}
												{change.toCharacter?.name ?? "Unknown"}
											</span>
											<Badge variant="secondary">
												{change.unread_count}{" "}
												{change.unread_count === 1 ? "change" : "changes"}
											</Badge>
										</ItemTitle>
										<div className="flex items-center gap-2">
											<Badge variant="outline">{change.typeLabel}</Badge>
										</div>
										<ItemDescription>
											{change.description || "No relationship note."}
										</ItemDescription>
									</ItemContent>

									<ItemActions className="basis-full justify-end sm:basis-auto">
										<Button
											variant="ghost"
											size="xs"
											onClick={() => {
												setSelectedCharId(change.from_id);
												onOpenChange(false);
											}}
										>
											<ArrowRight data-icon="inline-start" />
											Show character
										</Button>
										<Button
											variant="outline"
											size="xs"
											onClick={() =>
												markVersionsRead.mutate({
													relationshipId: change.relationship_id,
													latestVersionId: change.latest_version_id,
												})
											}
										>
											<Check data-icon="inline-start" />
											Mark read
										</Button>
									</ItemActions>
								</Item>
							))}
						</ItemGroup>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
