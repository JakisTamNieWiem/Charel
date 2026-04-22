import { ArrowRight, Shuffle } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, Relationship, RelationshipType } from "@/types/types";

function getInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

function fallbackType(): RelationshipType {
	return {
		id: "visual-link",
		label: "Visual Link",
		color: "oklch(0.72 0.14 148)",
		description: "A purely visual relationship preview.",
		value: 0.25,
	};
}

function getSentimentLabel(value: number) {
	if (value > 0.45) return "High affinity";
	if (value > 0.1) return "Positive pull";
	if (value < -0.45) return "Hard conflict";
	if (value < -0.1) return "Tension";
	return "Neutral contact";
}

function pickFallbackPair(
	characters: Character[],
	relationships: Relationship[],
	typeId: string | null,
) {
	const characterIds = new Set(characters.map((character) => character.id));
	const relationship = relationships.find(
		(candidate) =>
			candidate.typeId === typeId &&
			characterIds.has(candidate.fromId) &&
			characterIds.has(candidate.toId),
	);

	if (relationship) {
		return [
			characters.find((character) => character.id === relationship.fromId) ??
				null,
			characters.find((character) => character.id === relationship.toId) ??
				null,
		];
	}

	return characters.length >= 2 ? [characters[0], characters[1]] : [null, null];
}

export default function LinkView() {
	const characters = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const relationshipTypes = useGraphStore((state) => state.relationshipTypes);
	const sourceId = useGraphStore((state) => state.linkViewSourceId);
	const targetId = useGraphStore((state) => state.linkViewTargetId);
	const typeId = useGraphStore((state) => state.linkViewTypeId);
	const setLinkViewSelection = useGraphStore(
		(state) => state.setLinkViewSelection,
	);
	const randomizeLinkView = useGraphStore((state) => state.randomizeLinkView);

	const fallbackPair = useMemo(
		() => pickFallbackPair(characters, relationships, typeId),
		[characters, relationships, typeId],
	);
	const source =
		characters.find((character) => character.id === sourceId) ??
		fallbackPair[0];
	const target =
		characters.find((character) => character.id === targetId) ??
		fallbackPair[1];
	const linkType =
		relationshipTypes.find((type) => type.id === typeId) ??
		relationshipTypes[0] ??
		fallbackType();
	const linkStrength = Math.round(((linkType.value + 1) / 2) * 100);

	useEffect(() => {
		if (characters.length < 2) {
			return;
		}

		const activeTypeId = typeId ?? relationshipTypes[0]?.id ?? null;
		const characterIds = new Set(characters.map((character) => character.id));
		const hasEligibleRelationship = relationships.some(
			(relationship) =>
				relationship.typeId === activeTypeId &&
				characterIds.has(relationship.fromId) &&
				characterIds.has(relationship.toId),
		);
		const hasValidPair =
			source &&
			target &&
			source.id !== target.id &&
			relationships.some(
				(relationship) =>
					relationship.typeId === activeTypeId &&
					relationship.fromId === source.id &&
					relationship.toId === target.id,
			);

		if (!hasValidPair && hasEligibleRelationship) {
			randomizeLinkView();
			return;
		}

		if (!typeId && relationshipTypes[0]) {
			setLinkViewSelection({ typeId: relationshipTypes[0].id });
		}
	}, [
		characters,
		randomizeLinkView,
		relationshipTypes,
		relationships,
		setLinkViewSelection,
		source,
		target,
		typeId,
	]);

	if (characters.length < 2 || !source || !target) {
		return (
			<div className="link-view link-view-empty">
				<div>
					<p>Visual Link</p>
					<h1>Need two characters</h1>
					<span>Add at least two characters to preview a link.</span>
				</div>
			</div>
		);
	}

	return (
		<div
			className="link-view"
			style={{ "--link-color": linkType.color } as CSSProperties}
		>
			<div className="link-view-backdrop" aria-hidden="true" />

			<section className="link-view-stage" aria-label="Visual link preview">
				<div className="link-view-rail" aria-hidden="true">
					<span />
					<span />
					<span />
				</div>

				<svg
					className="link-view-arc"
					viewBox="0 0 1000 260"
					focusable="false"
					aria-hidden="true"
				>
					<path
						className="link-view-path"
						d="M145 156 C350 28 650 28 855 156"
					/>
					<path
						className="link-view-path-glow"
						d="M145 156 C350 28 650 28 855 156"
					/>
					<path
						className="link-view-path-pulse"
						d="M145 156 C350 28 650 28 855 156"
					/>
				</svg>

				<CharacterNode character={source} align="left" />

				<div className="link-view-connection" aria-hidden="true">
					<div className="link-view-token">
						<span>Selected Link</span>
						<strong>{linkType.label}</strong>
						<small>{getSentimentLabel(linkType.value)}</small>
					</div>
				</div>

				<CharacterNode character={target} align="right" />
			</section>

			<footer className="link-view-dock">
				<div>
					<span>Source</span>
					<strong>{source.name}</strong>
				</div>
				<ArrowRight className="size-4" strokeWidth={1.8} />
				<div>
					<span>Target</span>
					<strong>{target.name}</strong>
				</div>
				<div>
					<span>Signal</span>
					<strong>{linkStrength}%</strong>
				</div>
				<Button
					variant="secondary"
					size="sm"
					onClick={randomizeLinkView}
					className="h-9 gap-2 rounded-full px-4 text-[0.6875rem] font-bold uppercase tracking-[0.14em]"
				>
					<Shuffle className="size-3.5" />
					Shuffle
				</Button>
			</footer>
		</div>
	);
}

function CharacterNode({
	character,
	align,
}: {
	character: Character;
	align: "left" | "right";
}) {
	return (
		<article className={`link-view-character is-${align}`}>
			<div className="link-view-orbit" aria-hidden="true" />
			<Avatar className="link-view-avatar">
				<AvatarImage src={character.avatar ?? undefined} />
				<AvatarFallback>{getInitials(character.name)}</AvatarFallback>
			</Avatar>
			<div className="link-view-nameplate">
				<span>{align === "left" ? "Character A" : "Character B"}</span>
				<strong>{character.name}</strong>
			</div>
		</article>
	);
}
