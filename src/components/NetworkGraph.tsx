import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import AnalyticsPanel from "./AnalyticsPanel";

interface Node {
	id: string;
	x: number;
	y: number;
	vx: number;
	vy: number;
	name: string;
	avatar?: string;
}

export default function NetworkGraph() {
	const allChars = useGraphStore((s) => s.characters);
	const relationships = useGraphStore((s) => s.relationships);
	const types = useGraphStore((s) => s.relationshipTypes);
	const groups = useGraphStore((s) => s.groups);
	const setSelectedCharId = useGraphStore((s) => s.setSelectedCharId);

	const containerRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const gRef = useRef<SVGGElement>(null);
	const panRef = useRef({ x: 0, y: 0 });
	const scaleRef = useRef(1);
	const isDraggingRef = useRef(false);
	const [isDragging, setIsDragging] = useState(false);
	const dragNodeRef = useRef<string | null>(null);
	const [hoveredNode, setHoveredNode] = useState<string | null>(null);

	// Force simulation
	const nodesRef = useRef<Node[]>([]);
	const animFrameRef = useRef<number>(0);
	const [tick, setTick] = useState(0);

	// Initialize nodes with positions
	useEffect(() => {
		const existing = new Map(nodesRef.current.map((n) => [n.id, n]));
		const angle = (2 * Math.PI) / Math.max(allChars.length, 1);
		const initRadius = Math.max(300, allChars.length * 20);

		nodesRef.current = allChars.map((c, i) => {
			const prev = existing.get(c.id);
			if (prev) return { ...prev, name: c.name, avatar: c.avatar };
			return {
				id: c.id,
				x: initRadius * Math.cos(i * angle),
				y: initRadius * Math.sin(i * angle),
				vx: 0,
				vy: 0,
				name: c.name,
				avatar: c.avatar,
			};
		});
	}, [allChars]);

	// Clustering: use user-defined groups, fall back to label propagation for ungrouped
	const clustersRef = useRef<Map<string, number>>(new Map());

	useEffect(() => {
		const clusterMap = new Map<string, number>();
		const hasGroups = groups.length > 0;

		if (hasGroups) {
			// Use user-defined groups
			const groupIdToIdx = new Map<string, number>();
			let idx = 0;
			for (const g of groups) {
				groupIdToIdx.set(g.id, idx++);
			}
			const ungroupedIdx = idx; // ungrouped characters get their own cluster

			for (const c of allChars) {
				if (c.groupId && groupIdToIdx.has(c.groupId)) {
					clusterMap.set(c.id, groupIdToIdx.get(c.groupId) ?? 0);
				} else {
					clusterMap.set(c.id, ungroupedIdx);
				}
			}
		} else {
			// Label propagation fallback
			const adj = new Map<string, Map<string, number>>();
			for (const c of allChars) adj.set(c.id, new Map());
			for (const r of relationships) {
				const w = adj.get(r.fromId)?.get(r.toId) ?? 0;
				adj.get(r.fromId)?.set(r.toId, w + 1);
				adj.get(r.toId)?.set(r.fromId, w + 1);
			}

			const labels = new Map<string, number>();
			for (let i = 0; i < allChars.length; i++) {
				labels.set(allChars[i].id, i);
			}

			for (let pass = 0; pass < 20; pass++) {
				let changed = false;
				const shuffled = [...allChars].sort(() => Math.random() - 0.5);

				for (const c of shuffled) {
					const neighbors = adj.get(c.id);
					if (!neighbors || neighbors.size === 0) continue;

					const votes = new Map<number, number>();
					for (const [nId, weight] of neighbors) {
						const nLabel = labels.get(nId) ?? 0;
						votes.set(nLabel, (votes.get(nLabel) ?? 0) + weight);
					}

					let bestLabel = labels.get(c.id) ?? 0;
					let bestScore = 0;
					for (const [label, score] of votes) {
						if (score > bestScore) {
							bestScore = score;
							bestLabel = label;
						}
					}

					if (bestLabel !== labels.get(c.id)) {
						labels.set(c.id, bestLabel);
						changed = true;
					}
				}
				if (!changed) break;
			}

			const labelToIdx = new Map<number, number>();
			let idx = 0;
			for (const c of allChars) {
				const label = labels.get(c.id) ?? 0;
				if (!labelToIdx.has(label)) labelToIdx.set(label, idx++);
				clusterMap.set(c.id, labelToIdx.get(label) ?? 0);
			}
		}

		clustersRef.current = clusterMap;
	}, [allChars, relationships, groups]);

	// Force simulation loop — restarts when relationships or groups change
	useEffect(() => {
		// groups is read indirectly via clustersRef, but we need this effect
		// to restart when groups change so cluster anchors are recomputed
		void groups;
		let running = true;
		let coolingFactor = 1;
		const DAMPING = 0.85;
		const REPULSION = 18000;
		const ATTRACTION = 0.012;
		const CENTER_GRAVITY = 0.002;
		const MIN_DIST = 90;
		const HARD_MIN = 70;

		// Compute cluster centers for island gravity
		const clusterMap = clustersRef.current;
		const numClusters = new Set(clusterMap.values()).size;

		// Place cluster anchors in a circle
		const clusterAnchors = new Map<number, { x: number; y: number }>();
		const clusterRadius = Math.max(700, numClusters * 300);
		for (let i = 0; i < numClusters; i++) {
			const angle = (i / numClusters) * 2 * Math.PI;
			clusterAnchors.set(i, {
				x: clusterRadius * Math.cos(angle),
				y: clusterRadius * Math.sin(angle),
			});
		}

		const simulate = () => {
			if (!running) return;
			const nodes = nodesRef.current;
			if (nodes.length === 0) {
				animFrameRef.current = requestAnimationFrame(simulate);
				return;
			}

			// Reset forces
			for (const n of nodes) {
				n.vx = 0;
				n.vy = 0;
			}

			// Repulsion between all pairs
			for (let i = 0; i < nodes.length; i++) {
				for (let j = i + 1; j < nodes.length; j++) {
					const a = nodes[i];
					const b = nodes[j];
					let dx = a.x - b.x;
					let dy = a.y - b.y;
					let dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < 1) {
						dx = (Math.random() - 0.5) * 2;
						dy = (Math.random() - 0.5) * 2;
						dist = 1;
					}
					// Stronger repulsion between nodes in different clusters
					const sameCluster =
						clusterMap.get(a.id) === clusterMap.get(b.id);
					const rep = sameCluster ? REPULSION : REPULSION * 8;
					const force = rep / (dist * dist);
					const fx = (dx / dist) * force;
					const fy = (dy / dist) * force;
					a.vx += fx;
					a.vy += fy;
					b.vx -= fx;
					b.vy -= fy;
				}
			}

			// Hard separation
			for (let i = 0; i < nodes.length; i++) {
				for (let j = i + 1; j < nodes.length; j++) {
					const a = nodes[i];
					const b = nodes[j];
					const dx = a.x - b.x;
					const dy = a.y - b.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < HARD_MIN && dist > 0.1) {
						const push = ((HARD_MIN - dist) / dist) * 0.5;
						a.vx += dx * push;
						a.vy += dy * push;
						b.vx -= dx * push;
						b.vy -= dy * push;
					}
				}
			}

			// Attraction along edges (pulls connected nodes together)
			const nodeMap = new Map(nodes.map((n) => [n.id, n]));
			for (const rel of relationships) {
				const a = nodeMap.get(rel.fromId);
				const b = nodeMap.get(rel.toId);
				if (!a || !b) continue;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < MIN_DIST) continue;
				const force = (dist - MIN_DIST) * ATTRACTION;
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				a.vx += fx;
				a.vy += fy;
				b.vx -= fx;
				b.vy -= fy;
			}

			// Cluster gravity: pull each node toward its cluster anchor
			const CLUSTER_GRAVITY = 0.035;
			for (const n of nodes) {
				const ci = clusterMap.get(n.id);
				const anchor =
					ci !== undefined ? clusterAnchors.get(ci) : undefined;
				if (anchor) {
					n.vx += (anchor.x - n.x) * CLUSTER_GRAVITY;
					n.vy += (anchor.y - n.y) * CLUSTER_GRAVITY;
				}
			}

			// Light global center gravity (keeps everything on screen)
			for (const n of nodes) {
				n.vx -= n.x * CENTER_GRAVITY;
				n.vy -= n.y * CENTER_GRAVITY;
			}

			// Apply velocities with damping and cooling
			for (const n of nodes) {
				if (dragNodeRef.current === n.id) continue;
				n.vx *= DAMPING * coolingFactor;
				n.vy *= DAMPING * coolingFactor;
				n.x += n.vx;
				n.y += n.vy;
			}

			coolingFactor = Math.max(0.01, coolingFactor * 0.998);
			setTick((t) => t + 1);
			animFrameRef.current = requestAnimationFrame(simulate);
		};

		animFrameRef.current = requestAnimationFrame(simulate);
		return () => {
			running = false;
			cancelAnimationFrame(animFrameRef.current);
		};
	}, [relationships, groups]);

	const applyTransform = useCallback(() => {
		if (gRef.current) {
			gRef.current.setAttribute(
				"transform",
				`translate(${panRef.current.x}, ${panRef.current.y}) scale(${scaleRef.current})`,
			);
		}
	}, []);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			const zoomSensitivity = 0.002;
			scaleRef.current = Math.max(
				0.1,
				Math.min(scaleRef.current - e.deltaY * zoomSensitivity, 5),
			);
			applyTransform();
		},
		[applyTransform],
	);

	// tick in deps forces re-read of nodesRef on each simulation frame
	void tick;
	const nodes = nodesRef.current;
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	const nodeRadius = 24;

	// Build group visual data: bounding circle per group
	const groupBubbles = groups
		.map((g) => {
			const memberNodes = nodes.filter((n) => {
				const char = allChars.find((c) => c.id === n.id);
				return char?.groupId === g.id;
			});
			if (memberNodes.length === 0) return null;

			// Compute centroid
			const cx =
				memberNodes.reduce((s, n) => s + n.x, 0) / memberNodes.length;
			const cy =
				memberNodes.reduce((s, n) => s + n.y, 0) / memberNodes.length;

			// Radius = distance to farthest member + padding
			const maxDist = Math.max(
				...memberNodes.map((n) =>
					Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2),
				),
			);
			const r = maxDist + nodeRadius + 30;

			return { id: g.id, name: g.name, color: g.color, cx, cy, r };
		})
		.filter(Boolean) as {
		id: string;
		name: string;
		color: string;
		cx: number;
		cy: number;
		r: number;
	}[];

	return (
		<div className="flex h-full">
			<div
				ref={containerRef}
				className={cn(
					"flex-1 h-full overflow-hidden touch-none select-none",
					isDragging ? "cursor-grabbing" : "cursor-grab",
				)}
				onWheel={handleWheel}
				onPointerDown={(e) => {
					setIsDragging(true);
					isDraggingRef.current = true;
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={(e) => {
					if (dragNodeRef.current) {
						// Dragging a node
						const node = nodesRef.current.find(
							(n) => n.id === dragNodeRef.current,
						);
						if (node) {
							node.x += e.movementX / scaleRef.current;
							node.y += e.movementY / scaleRef.current;
						}
					} else if (isDraggingRef.current) {
						panRef.current.x += e.movementX;
						panRef.current.y += e.movementY;
						applyTransform();
					}
				}}
				onPointerUp={() => {
					setIsDragging(false);
					isDraggingRef.current = false;
					dragNodeRef.current = null;
				}}
				onPointerCancel={() => {
					isDraggingRef.current = false;
					dragNodeRef.current = null;
				}}
			>
				<svg
					ref={svgRef}
					className="w-full h-full overflow-visible"
					viewBox="-1000 -1000 2000 2000"
				>
					<g ref={gRef} transform="translate(0, 0) scale(1)">
						{/* Group bubbles */}
						{groupBubbles.map((gb) => (
							<g key={`group-${gb.id}`}>
								<circle
									cx={gb.cx}
									cy={gb.cy}
									r={gb.r}
									fill={gb.color}
									opacity={0.06}
									stroke={gb.color}
									strokeWidth={1.5}
									strokeOpacity={0.25}
									strokeDasharray="6 4"
								/>
								<text
									x={gb.cx}
									y={gb.cy - gb.r - 8}
									textAnchor="middle"
									fill={gb.color}
									opacity={0.5}
									className="text-[11px] font-bold uppercase tracking-widest pointer-events-none"
								>
									{gb.name}
								</text>
							</g>
						))}

						{/* Edges */}
						{relationships.map((rel) => {
							const from = nodeMap.get(rel.fromId);
							const to = nodeMap.get(rel.toId);
							if (!from || !to) return null;
							const type = types.find((t) => t.id === rel.typeId);
							const relId = `${rel.fromId}-${rel.toId}-${rel.typeId}`;

							// Calculate opacity based on relationship value (override or type default)
							const typeValue = rel.value ?? type?.value ?? 0;
							const absVal = Math.abs(typeValue);
							const opacity = 0.15 + absVal * 0.65;

							// Calculate stroke width based on value magnitude
							const strokeWidth = 1 + absVal * 2;

							return (
								<line
									key={relId}
									x1={from.x}
									y1={from.y}
									x2={to.x}
									y2={to.y}
									stroke={type?.color || "#555"}
									strokeWidth={strokeWidth}
									opacity={opacity}
									strokeLinecap="round"
								/>
							);
						})}

						{/* Nodes */}
						{nodes.map((node) => {
							const isHovered = hoveredNode === node.id;
							return (
								<g
									key={node.id}
									className="cursor-pointer"
									onPointerDown={(e) => {
										e.stopPropagation();
										dragNodeRef.current = node.id;
									}}
									onDoubleClick={(e) => {
										e.stopPropagation();
										setSelectedCharId(node.id);
									}}
									onMouseEnter={() => setHoveredNode(node.id)}
									onMouseLeave={() => setHoveredNode(null)}
								>
									<circle
										cx={node.x}
										cy={node.y}
										r={nodeRadius + 2}
										fill="#0a0a0a"
										stroke="white"
										strokeWidth={isHovered ? 2 : 1}
										className={cn(
											"transition-opacity",
											isHovered ? "opacity-60" : "opacity-20",
										)}
									/>
									<clipPath id={`nclip-${node.id}`}>
										<circle cx={node.x} cy={node.y} r={nodeRadius} />
									</clipPath>
									{node.avatar ? (
										<image
											href={node.avatar}
											x={node.x - nodeRadius}
											y={node.y - nodeRadius}
											width={nodeRadius * 2}
											height={nodeRadius * 2}
											clipPath={`url(#nclip-${node.id})`}
											// @ts-expect-error: referrerPolicy valid on SVGImageElement
											referrerPolicy="no-referrer"
										/>
									) : (
										<circle
											cx={node.x}
											cy={node.y}
											r={nodeRadius}
											fill="#1a1a1a"
										/>
									)}
									{isHovered && (
										<text
											x={node.x}
											y={node.y - nodeRadius - 10}
											textAnchor="middle"
											className="fill-white text-[10px] font-bold uppercase tracking-widest pointer-events-none"
										>
											{node.name}
										</text>
									)}
								</g>
							);
						})}
					</g>
				</svg>
			</div>

			{/* Analytics Side Panel */}
			<AnalyticsPanel />
		</div>
	);
}
