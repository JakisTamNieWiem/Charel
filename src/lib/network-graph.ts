import type {
	Character,
	Group,
	Relationship,
	RelationshipType,
} from "@/types/types";

export const NODE_SIZE = 20;
export const AVATAR_CACHE_SIZE = 256;
const AVATAR_BUCKETS = [32, 48, 64, 96, 128, 192, 256];

export type AvatarQualityTier = "interactive" | "settled";

export interface ComputedNode {
	id: string;
	name: string;
	groupId: string | null;
	avatar: string | null;
	x: number;
	y: number;
	color: string;
	initials: string;
	groupCx: number;
	groupCy: number;
}

export interface ComputedLink {
	sourceId: string;
	targetId: string;
	source: ComputedNode;
	target: ComputedNode;
	typeId: string;
	color: string;
	cpX?: number;
	cpY?: number;
}

export interface ComputedGroup {
	id: string;
	name: string;
	color: string;
	cx: number;
	cy: number;
	radius: number;
	angle: number;
}

export interface LayoutData {
	nodes: ComputedNode[];
	links: ComputedLink[];
	groups: ComputedGroup[];
	nodeMap: Map<string, ComputedNode>;
}

export interface ViewportBounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export interface AvatarSpriteSpec {
	cacheKey: string;
	size: number;
}

function getPairKey(leftId: string, rightId: string) {
	return leftId < rightId ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;
}

function getSymmetricOffset(index: number, count: number, avoidZero = false) {
	const centered = index - (count - 1) / 2;

	if (!avoidZero || centered !== 0) {
		return centered;
	}

	return 0.5;
}

export function pickAvatarBucket(targetSize: number) {
	return (
		AVATAR_BUCKETS.find((bucket) => bucket >= targetSize) ??
		AVATAR_BUCKETS[AVATAR_BUCKETS.length - 1]
	);
}

export function getAvatarSpriteSpec(
	avatarUrl: string,
	tier: AvatarQualityTier,
	scale: number,
	dpr: number,
): AvatarSpriteSpec {
	const screenDiameter =
		NODE_SIZE * 2 * Math.max(scale, 0.35) * Math.max(dpr, 1);
	const targetSize =
		tier === "interactive"
			? Math.max(32, screenDiameter * 1.15)
			: Math.max(64, screenDiameter * 2);
	const size = pickAvatarBucket(Math.min(targetSize, AVATAR_CACHE_SIZE));

	return {
		cacheKey: `${avatarUrl}|${tier}|${size}`,
		size,
	};
}

export function getViewportBounds(
	transform: { x: number; y: number; k: number },
	width: number,
	height: number,
): ViewportBounds {
	return {
		left: -transform.x / transform.k,
		right: (width - transform.x) / transform.k,
		top: -transform.y / transform.k,
		bottom: (height - transform.y) / transform.k,
	};
}

export function isCircleVisible(
	bounds: ViewportBounds,
	x: number,
	y: number,
	radius: number,
) {
	return !(
		x + radius < bounds.left ||
		x - radius > bounds.right ||
		y + radius < bounds.top ||
		y - radius > bounds.bottom
	);
}

export function isLinkVisible(
	bounds: ViewportBounds,
	link: ComputedLink,
	padding: number,
) {
	const xs =
		link.cpX != null
			? [link.source.x, link.target.x, link.cpX]
			: [link.source.x, link.target.x];
	const ys =
		link.cpY != null
			? [link.source.y, link.target.y, link.cpY]
			: [link.source.y, link.target.y];
	const minX = Math.min(...xs) - padding;
	const maxX = Math.max(...xs) + padding;
	const minY = Math.min(...ys) - padding;
	const maxY = Math.max(...ys) + padding;

	return !(
		maxX < bounds.left ||
		minX > bounds.right ||
		maxY < bounds.top ||
		minY > bounds.bottom
	);
}

export function findNodeAtPosition(
	nodes: ComputedNode[],
	worldX: number,
	worldY: number,
	radius = NODE_SIZE,
) {
	return (
		nodes.find((node) => {
			const dx = node.x - worldX;
			const dy = node.y - worldY;

			return dx * dx + dy * dy <= radius * radius;
		}) ?? null
	);
}

export function buildNetworkLayout(
	allChars: Character[],
	relationships: Relationship[],
	types: RelationshipType[],
	groups: Group[],
	networkMode: "group" | "global",
): LayoutData {
	const typeMap = new Map(types.map((type) => [type.id, type]));
	const groupInfoMap = new Map(groups.map((group) => [group.id, group]));
	const nodes: ComputedNode[] = [];
	const groupBounds: ComputedGroup[] = [];

	if (networkMode === "global") {
		const sortedChars = [...allChars].sort((left, right) =>
			left.name.localeCompare(right.name),
		);
		const radius = Math.max(400, sortedChars.length * 20);

		sortedChars.forEach((character, index) => {
			const group = groupInfoMap.get(character.groupId || "");
			const angle = (index / sortedChars.length) * 2 * Math.PI - Math.PI / 2;

			nodes.push({
				id: character.id,
				name: character.name,
				groupId: character.groupId,
				avatar: character.avatar,
				x: Math.cos(angle) * radius,
				y: Math.sin(angle) * radius,
				color: group?.color || "#ffffff",
				initials: character.name.substring(0, 2).toUpperCase(),
				groupCx: 0,
				groupCy: 0,
			});
		});
	} else {
		const groupedCharacters = new Map<string | null, Character[]>();

		for (const character of allChars) {
			const entries = groupedCharacters.get(character.groupId) || [];
			entries.push(character);
			groupedCharacters.set(character.groupId, entries);
		}

		const sortedGroupIds = Array.from(groupedCharacters.keys());
		const groupCount = sortedGroupIds.length;
		const outerRadius = 600;

		sortedGroupIds.forEach((groupId, groupIndex) => {
			const groupNodes = groupedCharacters.get(groupId) || [];
			const groupInfo = groupInfoMap.get(groupId || "");
			const innerRadius = Math.max(80, groupNodes.length * 10);
			const groupAngle = (groupIndex / groupCount) * 2 * Math.PI - Math.PI / 2;
			const gCx = groupCount <= 1 ? 0 : Math.cos(groupAngle) * outerRadius;
			const gCy = groupCount <= 1 ? 0 : Math.sin(groupAngle) * outerRadius;

			groupNodes.forEach((character, nodeIndex) => {
				const nodeAngle = (nodeIndex / groupNodes.length) * 2 * Math.PI;

				nodes.push({
					id: character.id,
					name: character.name,
					groupId: character.groupId,
					avatar: character.avatar,
					x:
						groupNodes.length === 1
							? gCx
							: gCx + Math.cos(nodeAngle) * innerRadius,
					y:
						groupNodes.length === 1
							? gCy
							: gCy + Math.sin(nodeAngle) * innerRadius,
					color: groupInfo?.color || "#ffffff",
					initials: character.name.substring(0, 2).toUpperCase(),
					groupCx: gCx,
					groupCy: gCy,
				});
			});

			if (groupInfo) {
				groupBounds.push({
					id: groupInfo.id,
					name: groupInfo.name,
					color: groupInfo.color,
					cx: gCx,
					cy: gCy,
					radius: innerRadius + 40,
					angle: groupAngle,
				});
			}
		});
	}

	const nodeMap = new Map(nodes.map((node) => [node.id, node]));
	const links: ComputedLink[] = [];
	const relationshipsByPair = new Map<string, Relationship[]>();

	for (const relationship of relationships) {
		const pairKey = getPairKey(relationship.fromId, relationship.toId);
		const pairRelationships = relationshipsByPair.get(pairKey) ?? [];

		pairRelationships.push(relationship);
		relationshipsByPair.set(pairKey, pairRelationships);
	}

	for (const relationship of relationships) {
		const source = nodeMap.get(relationship.fromId);
		const target = nodeMap.get(relationship.toId);

		if (!source || !target) {
			continue;
		}

		const type = typeMap.get(relationship.typeId);
		const isCrossGroup =
			networkMode === "group" ? source.groupId !== target.groupId : true;
		const pairRelationships =
			relationshipsByPair.get(getPairKey(source.id, target.id)) ?? [];
		const pairIndex = pairRelationships.findIndex(
			(candidate) =>
				candidate.fromId === relationship.fromId &&
				candidate.toId === relationship.toId &&
				candidate.typeId === relationship.typeId,
		);

		let cpX: number | undefined;
		let cpY: number | undefined;

		if (isCrossGroup || pairRelationships.length > 1) {
			const mx = (source.x + target.x) / 2;
			const my = (source.y + target.y) / 2;
			const dx = target.x - source.x;
			const dy = target.y - source.y;
			const pairOffset = getSymmetricOffset(
				Math.max(pairIndex, 0),
				pairRelationships.length,
				!isCrossGroup,
			);
			const curvatureStrength = isCrossGroup ? 0.25 : 0.16;
			const offsetMultiplier =
				isCrossGroup && pairRelationships.length === 1
					? 1
					: 1 + Math.abs(pairOffset) * 0.75;
			const direction = pairOffset < 0 ? -1 : 1;
			const perpendicularOffset =
				Math.hypot(dx, dy) * curvatureStrength * offsetMultiplier * direction;
			const normalX = dy === 0 && dx === 0 ? 0 : -dy / Math.hypot(dx, dy);
			const normalY = dy === 0 && dx === 0 ? 0 : dx / Math.hypot(dx, dy);

			cpX = mx + normalX * perpendicularOffset;
			cpY = my + normalY * perpendicularOffset;
		}

		links.push({
			sourceId: source.id,
			targetId: target.id,
			source,
			target,
			typeId: relationship.typeId,
			color: type?.color || "#555",
			cpX,
			cpY,
		});
	}

	return { nodes, links, groups: groupBounds, nodeMap };
}
