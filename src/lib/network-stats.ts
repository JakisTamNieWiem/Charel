import type { GraphData } from "@/types/types";

export interface CharacterStat {
	id: string;
	name: string;
	avatar: string | null;
	connectionCount: number;
	incomingCount: number;
	avgValue: number;
	totalPositive: number;
	totalNegative: number;
}

type RelationshipStat = { from: string; to: string; value: number };

export interface NetworkStats {
	charStats: CharacterStat[];
	mostLikeable?: CharacterStat;
	mostDisliked?: CharacterStat;
	mostConnected?: CharacterStat;
	leastConnected?: CharacterStat;
	bestRel: RelationshipStat | null;
	worstRel: RelationshipStat | null;
	totalRelationships: number;
	totalCharacters: number;
	avgRelValue: number;
	median: number;
	variance: number;
	stdDev: number;
	density: number;
	reciprocity: number;
	histogram: number[];
	connHistogram: number[];
	maxConn: number;
	positiveCount: number;
	negativeCount: number;
	neutralCount: number;
	groupStats: Array<{
		name: string;
		color: string;
		memberCount: number;
		internalRelations: number;
		avgValue: number;
	}>;
}

export function buildNetworkStats(data: GraphData): NetworkStats {
	const { characters, relationships, relationshipTypes, groups } = data;
	const typeValues = new Map(
		relationshipTypes.map((type) => [type.id, type.value]),
	);
	const characterById = new Map(
		characters.map((character) => [character.id, character]),
	);
	const relationshipValue = (relationship: (typeof relationships)[number]) =>
		relationship.value ?? typeValues.get(relationship.typeId) ?? 0;
	const allValues = relationships.map(relationshipValue);
	const sortedValues = [...allValues].sort((a, b) => a - b);
	const accumulators = new Map(
		characters.map((character) => [
			character.id,
			{ connections: 0, incoming: [] as number[] },
		]),
	);
	const pairAverages = new Map<
		string,
		{ sum: number; count: number; fromId: string; toId: string }
	>();

	for (const relationship of relationships) {
		const value = relationshipValue(relationship);
		const source = accumulators.get(relationship.fromId);
		const target = accumulators.get(relationship.toId);
		if (source) source.connections++;
		if (target && relationship.toId !== relationship.fromId)
			target.connections++;
		if (target) target.incoming.push(value);

		const pairKey = [relationship.fromId, relationship.toId].sort().join("|");
		const pair = pairAverages.get(pairKey);
		if (pair) {
			pair.sum += value;
			pair.count++;
		} else {
			pairAverages.set(pairKey, {
				sum: value,
				count: 1,
				fromId: relationship.fromId,
				toId: relationship.toId,
			});
		}
	}

	const charStats = characters.map((character) => {
		const accumulator = accumulators.get(character.id);
		const incoming = accumulator?.incoming ?? [];
		return {
			id: character.id,
			name: character.name,
			avatar: character.avatar,
			connectionCount: accumulator?.connections ?? 0,
			incomingCount: incoming.length,
			avgValue:
				incoming.length > 0
					? incoming.reduce((sum, value) => sum + value, 0) / incoming.length
					: 0,
			totalPositive: incoming.filter((value) => value > 0).length,
			totalNegative: incoming.filter((value) => value < 0).length,
		};
	});
	const withIncomingRelationships = charStats.filter(
		(character) => (accumulators.get(character.id)?.incoming.length ?? 0) > 0,
	);
	const mostLikeable = [...withIncomingRelationships].sort(
		(a, b) => b.avgValue - a.avgValue,
	)[0];
	const mostDisliked = [...withIncomingRelationships].sort(
		(a, b) => a.avgValue - b.avgValue,
	)[0];
	const mostConnected = [...charStats].sort(
		(a, b) => b.connectionCount - a.connectionCount,
	)[0];
	const leastConnected = [...charStats].sort(
		(a, b) => a.connectionCount - b.connectionCount,
	)[0];

	let bestRel: RelationshipStat | null = null;
	let worstRel: RelationshipStat | null = null;
	for (const pair of pairAverages.values()) {
		const from = characterById.get(pair.fromId);
		const to = characterById.get(pair.toId);
		if (!from || !to) continue;
		const value = pair.sum / pair.count;
		if (!bestRel || value > bestRel.value) {
			bestRel = { from: from.name, to: to.name, value };
		}
		if (!worstRel || value < worstRel.value) {
			worstRel = { from: from.name, to: to.name, value };
		}
	}

	const totalRelationships = relationships.length;
	const totalCharacters = characters.length;
	const avgRelValue =
		totalRelationships > 0
			? allValues.reduce((sum, value) => sum + value, 0) / totalRelationships
			: 0;
	const median =
		sortedValues.length === 0
			? 0
			: sortedValues.length % 2 === 1
				? sortedValues[Math.floor(sortedValues.length / 2)]
				: (sortedValues[sortedValues.length / 2 - 1] +
						sortedValues[sortedValues.length / 2]) /
					2;
	const variance =
		allValues.length > 0
			? allValues.reduce((sum, value) => sum + (value - avgRelValue) ** 2, 0) /
				allValues.length
			: 0;
	const maxEdges =
		totalCharacters > 1 ? (totalCharacters * (totalCharacters - 1)) / 2 : 0;
	const density = maxEdges > 0 ? pairAverages.size / maxEdges : 0;
	const edgeKeys = new Set(
		relationships.map(
			(relationship) => `${relationship.fromId}|${relationship.toId}`,
		),
	);
	const reciprocalCount = relationships.filter((relationship) =>
		edgeKeys.has(`${relationship.toId}|${relationship.fromId}`),
	).length;

	const histogram = Array.from({ length: 10 }, () => 0);
	for (const value of allValues) {
		const bin = Math.min(
			histogram.length - 1,
			Math.max(0, Math.floor(((value + 1) / 2) * histogram.length)),
		);
		histogram[bin]++;
	}
	const connectionCounts = charStats.map(
		(character) => character.connectionCount,
	);
	const maxConn = Math.max(0, ...connectionCounts);
	const connectionBinCount = Math.min(10, maxConn + 1);
	const connHistogram = Array.from({ length: connectionBinCount }, () => 0);
	for (const count of connectionCounts) {
		const bin = Math.min(
			connectionBinCount - 1,
			Math.floor((count / (maxConn + 1)) * connectionBinCount),
		);
		connHistogram[bin]++;
	}

	return {
		charStats,
		mostLikeable,
		mostDisliked,
		mostConnected,
		leastConnected,
		bestRel,
		worstRel,
		totalRelationships,
		totalCharacters,
		avgRelValue,
		median,
		variance,
		stdDev: Math.sqrt(variance),
		density,
		reciprocity:
			totalRelationships > 0 ? reciprocalCount / totalRelationships : 0,
		histogram,
		connHistogram,
		maxConn,
		positiveCount: allValues.filter((value) => value > 0).length,
		negativeCount: allValues.filter((value) => value < 0).length,
		neutralCount: allValues.filter((value) => value === 0).length,
		groupStats: groups.map((group) => {
			const memberIds = new Set(
				characters
					.filter((character) => character.groupId === group.id)
					.map((character) => character.id),
			);
			const internalRelationships = relationships.filter(
				(relationship) =>
					memberIds.has(relationship.fromId) &&
					memberIds.has(relationship.toId),
			);
			return {
				name: group.name,
				color: group.color,
				memberCount: memberIds.size,
				internalRelations: internalRelationships.length,
				avgValue:
					internalRelationships.length > 0
						? internalRelationships.reduce(
								(sum, relationship) => sum + relationshipValue(relationship),
								0,
							) / internalRelationships.length
						: 0,
			};
		}),
	};
}
