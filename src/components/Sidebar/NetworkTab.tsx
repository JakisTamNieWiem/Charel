import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { NetworkCurveStyle } from "@/lib/network-graph";
import { useGraphStore } from "@/store/useGraphStore";
import {
	SidebarPanel,
	SidebarSection,
	SidebarTabHeader,
	SidebarTabRoot,
	sidebarInputClass,
	sidebarRowClass,
} from "./SidebarTabLayout";

const curveStyleOptions: Array<{ value: NetworkCurveStyle; label: string }> = [
	{ value: "quadratic", label: "Quadratic" },
	{ value: "cubic", label: "Cubic" },
	{ value: "sine", label: "Sine wave" },
	{ value: "fractal", label: "Fractal" },
];

interface CharStat {
	id: string;
	name: string;
	avatar: string | null;
	connectionCount: number;
	avgValue: number;
	totalPositive: number;
	totalNegative: number;
}

export default function NetworkTab() {
	const characters = useGraphStore((s) => s.characters);
	const relationships = useGraphStore((s) => s.relationships);
	const types = useGraphStore((s) => s.relationshipTypes);
	const groups = useGraphStore((s) => s.groups);
	const networkCurveStyle = useGraphStore((s) => s.networkCurveStyle);
	const setNetworkCurveStyle = useGraphStore((s) => s.setNetworkCurveStyle);
	const stats = useMemo(() => {
		const typeValueMap = new Map(types.map((t) => [t.id, t.value ?? 0]));
		const relValue = (r: { typeId: string; value: number | null }) =>
			r.value ?? typeValueMap.get(r.typeId) ?? 0;

		const allValues = relationships.map(relValue);
		const sorted = [...allValues].sort((a, b) => a - b);

		const charStats: CharStat[] = characters.map((c) => {
			const rels = relationships.filter((r) => r.toId === c.id);
			const values = rels.map(relValue);
			const avg =
				values.length > 0
					? values.reduce((a, b) => a + b, 0) / values.length
					: 0;

			return {
				id: c.id,
				name: c.name,
				avatar: c.avatar,
				connectionCount: rels.length,
				avgValue: avg,
				totalPositive: values.filter((v) => v > 0).length,
				totalNegative: values.filter((v) => v < 0).length,
			};
		});

		const withConnections = charStats.filter((c) => c.connectionCount > 0);
		const mostLikeable = [...withConnections].sort(
			(a, b) => b.avgValue - a.avgValue,
		)[0];
		const mostDisliked = [...withConnections].sort(
			(a, b) => a.avgValue - b.avgValue,
		)[0];
		const mostConnected = [...charStats].sort(
			(a, b) => b.connectionCount - a.connectionCount,
		)[0];
		const leastConnected = [...withConnections].sort(
			(a, b) => a.connectionCount - b.connectionCount,
		)[0];

		const pairAvgs = new Map<
			string,
			{ sum: number; count: number; fromId: string; toId: string }
		>();
		for (const r of relationships) {
			const pairKey = [r.fromId, r.toId].sort().join("|");
			const existing = pairAvgs.get(pairKey);
			const val = relValue(r);
			if (existing) {
				existing.sum += val;
				existing.count += 1;
			} else {
				pairAvgs.set(pairKey, {
					sum: val,
					count: 1,
					fromId: r.fromId,
					toId: r.toId,
				});
			}
		}

		let bestRel: { from: string; to: string; value: number } | null = null;
		let worstRel: { from: string; to: string; value: number } | null = null;
		for (const pair of pairAvgs.values()) {
			const avg = pair.sum / pair.count;
			const fromChar = characters.find((c) => c.id === pair.fromId);
			const toChar = characters.find((c) => c.id === pair.toId);
			if (!fromChar || !toChar) continue;
			if (!bestRel || avg > bestRel.value) {
				bestRel = { from: fromChar.name, to: toChar.name, value: avg };
			}
			if (!worstRel || avg < worstRel.value) {
				worstRel = { from: fromChar.name, to: toChar.name, value: avg };
			}
		}

		const totalRelationships = relationships.length;
		const totalCharacters = characters.length;
		const avgRelValue =
			totalRelationships > 0
				? allValues.reduce((a, b) => a + b, 0) / totalRelationships
				: 0;

		const median =
			sorted.length === 0
				? 0
				: sorted.length % 2 === 1
					? sorted[Math.floor(sorted.length / 2)]
					: (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

		const variance =
			allValues.length > 0
				? allValues.reduce((sum, v) => sum + (v - avgRelValue) ** 2, 0) /
					allValues.length
				: 0;
		const stdDev = Math.sqrt(variance);

		const maxEdges =
			totalCharacters > 1 ? (totalCharacters * (totalCharacters - 1)) / 2 : 0;
		const density = maxEdges > 0 ? pairAvgs.size / maxEdges : 0;

		const edgeKeys = new Set(relationships.map((r) => `${r.fromId}|${r.toId}`));
		const reciprocalCount = relationships.filter((r) =>
			edgeKeys.has(`${r.toId}|${r.fromId}`),
		).length;
		const reciprocity =
			totalRelationships > 0 ? reciprocalCount / totalRelationships : 0;

		const histBins = 10;
		const histogram = Array.from({ length: histBins }, () => 0);
		for (const v of allValues) {
			const bin = Math.min(
				histBins - 1,
				Math.max(0, Math.floor(((v + 1) / 2) * histBins)),
			);
			histogram[bin]++;
		}

		const connCounts = charStats.map((c) => c.connectionCount);
		const maxConn = Math.max(0, ...connCounts);
		const connBins = Math.min(10, maxConn + 1);
		const connHistogram = Array.from({ length: connBins }, () => 0);
		if (connBins > 0) {
			for (const cnt of connCounts) {
				const bin = Math.min(
					connBins - 1,
					Math.floor((cnt / (maxConn + 1)) * connBins),
				);
				connHistogram[bin]++;
			}
		}

		const positiveCount = allValues.filter((v) => v > 0).length;
		const negativeCount = allValues.filter((v) => v < 0).length;
		const neutralCount = allValues.filter((v) => v === 0).length;

		const groupStats = groups.map((g) => {
			const members = characters.filter((c) => c.groupId === g.id);
			const memberIds = new Set(members.map((c) => c.id));
			const internalRels = relationships.filter(
				(r) => memberIds.has(r.fromId) && memberIds.has(r.toId),
			);
			const avgVal =
				internalRels.length > 0
					? internalRels.reduce((a, r) => a + relValue(r), 0) /
						internalRels.length
					: 0;
			return {
				name: g.name,
				color: g.color,
				memberCount: members.length,
				internalRelations: internalRels.length,
				avgValue: avgVal,
			};
		});

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
			stdDev,
			density,
			reciprocity,
			histogram,
			connHistogram,
			maxConn,
			positiveCount,
			negativeCount,
			neutralCount,
			groupStats,
		};
	}, [characters, relationships, types, groups]);

	return (
		<SidebarTabRoot className="gap-5">
			<SidebarTabHeader title="Network" count={stats.totalRelationships} />

			<SidebarSection title="Relationship curves">
				<Select
					value={networkCurveStyle}
					onValueChange={(value) =>
						setNetworkCurveStyle(value as NetworkCurveStyle)
					}
				>
					<SelectTrigger
						id="network-curve-style"
						className={`${sidebarInputClass} h-9 w-full rounded-lg`}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Curve style</SelectLabel>
							{curveStyleOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</SidebarSection>

			<SidebarSection title="Overview">
				<div className="grid grid-cols-2 gap-3">
					<StatCard
						label="Characters"
						value={stats.totalCharacters.toString()}
					/>
					<StatCard
						label="Relations"
						value={stats.totalRelationships.toString()}
					/>
					<StatCard
						label="Avg Sentiment"
						value={
							(stats.avgRelValue > 0 ? "+" : "") + stats.avgRelValue.toFixed(2)
						}
						color={sentimentColor(stats.avgRelValue)}
					/>
					<StatCard
						label="Median"
						value={(stats.median > 0 ? "+" : "") + stats.median.toFixed(2)}
						color={sentimentColor(stats.median)}
					/>
					<StatCard
						label="Std Deviation"
						value={stats.stdDev.toFixed(3)}
						sub={`var: ${stats.variance.toFixed(3)}`}
					/>
					<StatCard
						label="Density"
						value={`${(stats.density * 100).toFixed(1)}%`}
					/>
					<StatCard
						label="Reciprocity"
						value={`${(stats.reciprocity * 100).toFixed(0)}%`}
					/>
					<StatCard
						label="Connectivity"
						value={
							stats.totalCharacters > 0
								? (
										(stats.totalRelationships * 2) /
										stats.totalCharacters
									).toFixed(1)
								: "0"
						}
						sub="avg links/char"
					/>
				</div>
			</SidebarSection>

			{stats.totalRelationships > 0 && (
				<SidebarSection title="Distribution" className="space-y-3">
					<SidebarPanel className="p-4">
						<div className="space-y-2">
							<h3 className="text-[0.625rem] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
								Sentiment
							</h3>
							<Histogram
								bins={stats.histogram}
								labels={stats.histogram.map((_, i) =>
									(-1 + (i * 2) / stats.histogram.length).toFixed(1),
								)}
							/>
						</div>
					</SidebarPanel>

					<SidebarPanel className="p-4">
						<div className="space-y-2">
							<h3 className="text-[0.625rem] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
								Connections per Character
							</h3>
							<Histogram
								bins={stats.connHistogram}
								labels={stats.connHistogram.map((_, i) =>
									Math.round(
										(i / stats.connHistogram.length) * (stats.maxConn + 1),
									).toString(),
								)}
								color="#60a5fa"
							/>
						</div>
					</SidebarPanel>
				</SidebarSection>
			)}

			{stats.totalRelationships > 0 && (
				<SidebarSection title="Polarity">
					<SidebarPanel className="space-y-3 p-4">
						<div className="h-2.5 rounded-full overflow-hidden flex bg-(--sidebar-foreground)/8">
							<div
								className="h-full bg-[#4ade80]"
								style={{
									width: `${(stats.positiveCount / stats.totalRelationships) * 100}%`,
								}}
							/>
							<div
								className="h-full bg-[#808080]"
								style={{
									width: `${(stats.neutralCount / stats.totalRelationships) * 100}%`,
								}}
							/>
							<div
								className="h-full bg-[#f87171]"
								style={{
									width: `${(stats.negativeCount / stats.totalRelationships) * 100}%`,
								}}
							/>
						</div>
						<div className="flex justify-between text-[0.625rem] font-mono text-muted-foreground/70">
							<span>{stats.positiveCount} pos</span>
							<span>{stats.neutralCount} neut</span>
							<span>{stats.negativeCount} neg</span>
						</div>
					</SidebarPanel>
				</SidebarSection>
			)}

			<SidebarSection title="Highlights">
				<div className="space-y-2">
					{stats.mostLikeable && (
						<CharacterStatRow
							title="Most Likeable"
							char={stats.mostLikeable}
							detailColor="#4ade80"
						/>
					)}
					{stats.mostDisliked && (
						<CharacterStatRow
							title="Most Disliked"
							char={stats.mostDisliked}
							detailColor="#f87171"
						/>
					)}
					{stats.mostConnected && (
						<CharacterStatRow
							title="Most Connected"
							char={stats.mostConnected}
							detailColor="#60a5fa"
							detail={`${stats.mostConnected.connectionCount} links`}
						/>
					)}
					{stats.leastConnected && (
						<CharacterStatRow
							title="Least Connected"
							char={stats.leastConnected}
							detailColor="#fbbf24"
							detail={`${stats.leastConnected.connectionCount} links`}
						/>
					)}
					{stats.bestRel && (
						<RelationStatRow title="Best Relation" rel={stats.bestRel} />
					)}
					{stats.worstRel && (
						<RelationStatRow title="Worst Relation" rel={stats.worstRel} />
					)}
				</div>
			</SidebarSection>

			{stats.groupStats.length > 0 && (
				<SidebarSection title="Groups">
					<div className="space-y-2">
						{stats.groupStats.map((g) => (
							<div
								key={g.name}
								className={`${sidebarRowClass} flex items-center gap-2 px-3 py-2.5`}
							>
								<div
									className="h-2.5 w-2.5 rounded-full shrink-0"
									style={{ backgroundColor: g.color }}
								/>
								<div className="flex-1 min-w-0">
									<p className="text-xs font-semibold truncate">{g.name}</p>
									<p className="text-[0.625rem] text-muted-foreground">
										{g.memberCount} members, {g.internalRelations} internal
									</p>
								</div>
								<span
									className="text-[10px] font-mono font-bold"
									style={{ color: sentimentColor(g.avgValue) }}
								>
									{g.avgValue > 0 ? "+" : ""}
									{g.avgValue.toFixed(2)}
								</span>
							</div>
						))}
					</div>
				</SidebarSection>
			)}

			<RatingLeaderboard title="Character Ratings" data={stats.charStats} />
		</SidebarTabRoot>
	);
}

function sentimentColor(v: number) {
	return v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#808080";
}

function Histogram({
	bins,
	labels,
	color,
}: {
	bins: number[];
	labels: string[];
	color?: string;
}) {
	const max = Math.max(1, ...bins);
	const w = 100 / bins.length;
	const topPad = 8;
	const barArea = 28;
	const totalH = 45; // Increased to accommodate labels
	return (
		<div className="space-y-2">
			<svg
				viewBox={`0 0 100 ${totalH}`}
				className="h-20 w-full"
				preserveAspectRatio="xMidYMid meet"
			>
				{bins.map((count, i) => {
					const h = (count / max) * barArea;
					const binCenter = -1 + ((i + 0.5) / bins.length) * 2;
					const fill = color ?? sentimentColor(binCenter);
					return (
						<g key={`${binCenter}-${count}`}>
							<rect
								x={i * w + 0.5}
								y={barArea + topPad - h}
								width={w - 1}
								height={h}
								rx={0.5}
								fill={fill}
								opacity={0.7}
							/>
							{count > 0 && (
								<text
									x={i * w + w / 2}
									y={barArea + topPad - h - 2}
									textAnchor="middle"
									className="fill-white text-[3.5px] opacity-60"
								>
									{count}
								</text>
							)}
						</g>
					);
				})}
			</svg>
			<div className="flex justify-between px-1 text-[0.5625rem] font-mono text-muted-foreground/55">
				<span>{labels[0]}</span>
				<span>{labels[Math.floor(labels.length / 2)]}</span>
				<span>{labels[labels.length - 1]}</span>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	color,
	sub,
}: {
	label: string;
	value: string;
	color?: string;
	sub?: string;
}) {
	return (
		<SidebarPanel className="p-3.5">
			<p className="text-[0.5625rem] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
				{label}
			</p>
			<p
				className="mt-1 text-lg font-bold leading-none tabular-nums"
				style={{ color }}
			>
				{value}
			</p>
			{sub && (
				<p className="mt-1 truncate text-[0.5625rem] text-muted-foreground/55">
					{sub}
				</p>
			)}
		</SidebarPanel>
	);
}

function CharacterStatRow({
	title,
	char,
	detailColor,
	detail,
}: {
	title: string;
	char: CharStat;
	detailColor: string;
	detail?: string;
}) {
	return (
		<div className={`${sidebarRowClass} flex items-center gap-3 px-3 py-2.5`}>
			<Avatar className="size-8">
				<AvatarImage src={char.avatar ?? undefined} />
				<AvatarFallback className="text-[10px]">
					{char.name.slice(0, 2)}
				</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				<p className="text-[0.5625rem] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
					{title}
				</p>
				<p className="truncate text-sm font-semibold">{char.name}</p>
			</div>
			<span
				className="text-xs font-mono font-bold"
				style={{ color: detailColor }}
			>
				{detail || `${char.avgValue > 0 ? "+" : ""}${char.avgValue.toFixed(2)}`}
			</span>
		</div>
	);
}

function RelationStatRow({
	title,
	rel,
}: {
	title: string;
	rel: { from: string; to: string; value: number };
}) {
	return (
		<div className={`${sidebarRowClass} px-3 py-2.5`}>
			<p className="mb-1 text-[0.5625rem] font-mono font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
				{title}
			</p>
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-semibold truncate">
					{rel.from} to {rel.to}
				</span>
				<span
					className="text-xs font-mono font-bold"
					style={{ color: sentimentColor(rel.value) }}
				>
					{rel.value > 0 ? "+" : ""}
					{rel.value.toFixed(2)}
				</span>
			</div>
		</div>
	);
}

function RatingLeaderboard({
	title,
	data,
}: {
	title: string;
	data: CharStat[];
}) {
	const sorted = [...data]
		.filter((c) => c.connectionCount > 0)
		.sort((a, b) => b.avgValue - a.avgValue);

	return (
		<SidebarSection title={title}>
			<div className="space-y-1.5">
				{sorted.map((c, i) => (
					<div
						key={c.id}
						className={`${sidebarRowClass} flex items-center gap-3 px-2 py-2`}
					>
						<span className="w-4 shrink-0 text-right text-[0.625rem] font-mono text-muted-foreground/45 tabular-nums">
							{i + 1}
						</span>
						<Avatar className="size-6 shrink-0">
							<AvatarImage src={c.avatar ?? undefined} />
							<AvatarFallback className="text-[8px]">
								{c.name.slice(0, 2)}
							</AvatarFallback>
						</Avatar>
						<span className="flex-1 truncate text-xs font-semibold">
							{c.name}
						</span>
						<div className="flex items-center gap-2">
							<span
								className="w-10 text-right text-[0.625rem] font-mono font-bold tabular-nums"
								style={{ color: sentimentColor(c.avgValue) }}
							>
								{c.avgValue > 0 ? "+" : ""}
								{c.avgValue.toFixed(2)}
							</span>
							<div className="h-1 w-12 overflow-hidden rounded-full bg-(--sidebar-foreground)/10">
								<div
									className="h-full rounded-full"
									style={{
										width: `${Math.abs(c.avgValue * 100)}%`,
										backgroundColor: sentimentColor(c.avgValue),
									}}
								/>
							</div>
						</div>
					</div>
				))}
			</div>
		</SidebarSection>
	);
}
