import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

	// --- FORCE INITIAL RENDER STATE ---
	const [isReady, setIsReady] = useState(false);

	// --- REFS FOR DIRECT DOM MANIPULATION ---
	const containerRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const gRef = useRef<SVGGElement>(null);

	const nodeRefs = useRef<Map<string, SVGGElement>>(new Map());
	const edgeRefs = useRef<Map<string, SVGLineElement>>(new Map());
	const groupRefs = useRef<Map<string, SVGCircleElement>>(new Map());
	const groupTextRefs = useRef<Map<string, SVGTextElement>>(new Map());

	// --- PAN & DRAG STATE ---
	const panRef = useRef({ x: 0, y: 0 });
	const scaleRef = useRef(1);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const rafRef = useRef<number | null>(null);

	const isDraggingRef = useRef(false);
	const [isDragging, setIsDragging] = useState(false);
	const dragNodeRef = useRef<string | null>(null);
	const [hoveredNode, setHoveredNode] = useState<string | null>(null);

	// --- PHYSICS ENGINE STATE ---
	const nodesRef = useRef<Node[]>([]);
	const animFrameRef = useRef<number>(0);
	const clustersRef = useRef<Map<string, number>>(new Map());
	const nodeRadius = 24;

	const getMousePositionInSVG = (e: React.PointerEvent) => {
		if (!svgRef.current) return { x: 0, y: 0 };
		const svg = svgRef.current;
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		return pt.matrixTransform(svg.getScreenCTM()?.inverse());
	};

	// 1. Initialize nodes & trigger first render!
	useEffect(() => {
		const existing = new Map(nodesRef.current.map((n) => [n.id, n]));
		const angle = (2 * Math.PI) / Math.max(allChars.length, 1);
		const initRadius = Math.max(300, allChars.length * 20);

		nodesRef.current = allChars.map((c, i) => {
			const prev = existing.get(c.id);
			if (prev) {
				// Keep existing physics velocity/position but update text/image
				prev.name = c.name;
				prev.avatar = c.avatar;
				return prev;
			}
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

		// THE FIX: Tell React the nodes are ready so it draws them into the DOM!
		setIsReady(true);
	}, [allChars]);

	// 2. Clustering logic
	useEffect(() => {
		const clusterMap = new Map<string, number>();
		const hasGroups = groups.length > 0;

		if (hasGroups) {
			const groupIdToIdx = new Map<string, number>();
			let idx = 0;
			for (const g of groups) groupIdToIdx.set(g.id, idx++);
			const ungroupedIdx = idx;

			for (const c of allChars) {
				if (c.groupId && groupIdToIdx.has(c.groupId)) {
					clusterMap.set(c.id, groupIdToIdx.get(c.groupId) ?? 0);
				} else {
					clusterMap.set(c.id, ungroupedIdx);
				}
			}
		} else {
			const adj = new Map<string, Map<string, number>>();
			for (const c of allChars) adj.set(c.id, new Map());
			for (const r of relationships) {
				const w = adj.get(r.fromId)?.get(r.toId) ?? 0;
				adj.get(r.fromId)?.set(r.toId, w + 1);
				adj.get(r.toId)?.set(r.fromId, w + 1);
			}

			const labels = new Map<string, number>();
			for (let i = 0; i < allChars.length; i++) labels.set(allChars[i].id, i);

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

	// 3. Force simulation loop
	useEffect(() => {
		if (!isReady) return; // Wait until DOM nodes are mounted!

		let running = true;
		let coolingFactor = 1;
		const DAMPING = 0.85;
		const REPULSION = 18000;
		const ATTRACTION = 0.012;
		const CENTER_GRAVITY = 0.002;
		const MIN_DIST = 90;
		const HARD_MIN = 70;

		const clusterMap = clustersRef.current;
		const numClusters = new Set(clusterMap.values()).size;

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

			for (const n of nodes) {
				n.vx = 0;
				n.vy = 0;
			}

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
					const sameCluster = clusterMap.get(a.id) === clusterMap.get(b.id);
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

			const CLUSTER_GRAVITY = 0.035;
			for (const n of nodes) {
				const ci = clusterMap.get(n.id);
				const anchor = ci !== undefined ? clusterAnchors.get(ci) : undefined;
				if (anchor) {
					n.vx += (anchor.x - n.x) * CLUSTER_GRAVITY;
					n.vy += (anchor.y - n.y) * CLUSTER_GRAVITY;
				}
			}

			for (const n of nodes) {
				n.vx -= n.x * CENTER_GRAVITY;
				n.vy -= n.y * CENTER_GRAVITY;
			}

			for (const n of nodes) {
				if (dragNodeRef.current !== n.id) {
					n.vx *= DAMPING * coolingFactor;
					n.vy *= DAMPING * coolingFactor;
					n.x += n.vx;
					n.y += n.vy;
				}

				const nodeEl = nodeRefs.current.get(n.id);
				if (nodeEl)
					nodeEl.setAttribute("transform", `translate(${n.x}, ${n.y})`);
			}

			for (const rel of relationships) {
				const from = nodeMap.get(rel.fromId);
				const to = nodeMap.get(rel.toId);
				const el = edgeRefs.current.get(
					`${rel.fromId}-${rel.toId}-${rel.typeId}`,
				);
				if (from && to && el) {
					el.setAttribute("x1", from.x.toString());
					el.setAttribute("y1", from.y.toString());
					el.setAttribute("x2", to.x.toString());
					el.setAttribute("y2", to.y.toString());
				}
			}

			for (const g of groups) {
				const memberNodes = nodes.filter(
					(n) => allChars.find((c) => c.id === n.id)?.groupId === g.id,
				);
				if (memberNodes.length === 0) continue;

				const cx =
					memberNodes.reduce((s, n) => s + n.x, 0) / memberNodes.length;
				const cy =
					memberNodes.reduce((s, n) => s + n.y, 0) / memberNodes.length;
				const maxDist = Math.max(
					...memberNodes.map((n) =>
						Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2),
					),
				);
				const r = maxDist + nodeRadius + 30;

				const circleEl = groupRefs.current.get(g.id);
				if (circleEl) {
					circleEl.setAttribute("cx", cx.toString());
					circleEl.setAttribute("cy", cy.toString());
					circleEl.setAttribute("r", r.toString());
				}
				const textEl = groupTextRefs.current.get(g.id);
				if (textEl) {
					textEl.setAttribute("x", cx.toString());
					textEl.setAttribute("y", (cy - r - 8).toString());
				}
			}

			coolingFactor = Math.max(0.01, coolingFactor * 0.998);
			animFrameRef.current = requestAnimationFrame(simulate);
		};

		animFrameRef.current = requestAnimationFrame(simulate);
		return () => {
			running = false;
			cancelAnimationFrame(animFrameRef.current);
		};
	}, [relationships, groups, allChars, isReady]);

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

	if (!isReady) {
		return (
			<div className="flex-1 h-full flex items-center justify-center bg-[#0a0a0a]">
				Loading Graph...
			</div>
		);
	}

	const nodes = nodesRef.current;
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	const groupBubbles = groups
		.map((g) => {
			const memberNodes = nodes.filter(
				(n) => allChars.find((c) => c.id === n.id)?.groupId === g.id,
			);
			return memberNodes.length > 0
				? { id: g.id, name: g.name, color: g.color }
				: null;
		})
		.filter(Boolean) as { id: string; name: string; color: string }[];

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
					e.currentTarget.setPointerCapture(e.pointerId);
					const svgPt = getMousePositionInSVG(e);

					if (!dragNodeRef.current) {
						setIsDragging(true);
						isDraggingRef.current = true;
						dragStartRef.current = {
							x: svgPt.x - panRef.current.x,
							y: svgPt.y - panRef.current.y,
						};
					}
				}}
				onPointerMove={(e) => {
					const svgPt = getMousePositionInSVG(e);

					if (dragNodeRef.current) {
						const nodeX = (svgPt.x - panRef.current.x) / scaleRef.current;
						const nodeY = (svgPt.y - panRef.current.y) / scaleRef.current;

						const node = nodesRef.current.find(
							(n) => n.id === dragNodeRef.current,
						);
						if (node) {
							node.x = nodeX;
							node.y = nodeY;
							node.vx = 0;
							node.vy = 0;
						}
					} else if (isDraggingRef.current) {
						panRef.current.x = svgPt.x - dragStartRef.current.x;
						panRef.current.y = svgPt.y - dragStartRef.current.y;

						if (!rafRef.current) {
							rafRef.current = requestAnimationFrame(() => {
								applyTransform();
								rafRef.current = null;
							});
						}
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
									ref={(el) => {
										if (el) groupRefs.current.set(gb.id, el);
									}}
									fill={gb.color}
									opacity={0.06}
									stroke={gb.color}
									strokeWidth={1.5}
									strokeOpacity={0.25}
									strokeDasharray="6 4"
								/>
								<text
									ref={(el) => {
										if (el) groupTextRefs.current.set(gb.id, el);
									}}
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

							const typeValue = rel.value ?? type?.value ?? 0;
							const absVal = Math.abs(typeValue);
							const strokeWidth = 1 + absVal * 2;

							return (
								<line
									key={relId}
									ref={(el) => {
										if (el) edgeRefs.current.set(relId, el);
									}}
									x1={from.x}
									y1={from.y}
									x2={to.x}
									y2={to.y}
									stroke={type?.color || "#555"}
									strokeWidth={strokeWidth}
									opacity={0.15 + absVal * 0.65}
									strokeLinecap="round"
								/>
							);
						})}

						{/* Nodes (REWRITTEN TO PURE SVG) */}
						{nodes.map((node) => {
							const isHovered = hoveredNode === node.id;
							return (
								<g
									key={node.id}
									ref={(el) => {
										if (el) nodeRefs.current.set(node.id, el);
									}}
									transform={`translate(${node.x}, ${node.y})`}
									className="cursor-pointer transition-all"
									onPointerDown={() => {
										dragNodeRef.current = node.id;
									}}
									onDoubleClick={(e) => {
										e.stopPropagation();
										setSelectedCharId(node.id);
									}}
									onMouseEnter={() => setHoveredNode(node.id)}
									onMouseLeave={() => setHoveredNode(null)}
								>
									{/* The Circular Background & Border */}
									<circle
										cx={0}
										cy={0}
										r={nodeRadius}
										fill="#141414"
										stroke={isHovered ? "white" : "rgba(255,255,255,0.3)"}
										strokeWidth={isHovered ? 3 : 2}
									/>

									{/* Pure SVG Image handling (Incredibly Fast) */}
									{node.avatar ? (
										<>
											<clipPath id={`clip-${node.id}`}>
												<circle cx={0} cy={0} r={nodeRadius - 1} />
											</clipPath>
											<image
												href={node.avatar}
												x={-nodeRadius}
												y={-nodeRadius}
												width={nodeRadius * 2}
												height={nodeRadius * 2}
												clipPath={`url(#clip-${node.id})`}
												// @ts-expect-error: standard in modern SVG but missing from React types
												referrerPolicy="no-referrer"
												preserveAspectRatio="xMidYMid slice"
											/>
										</>
									) : (
										// High performance Fallback Initials
										<text
											x={0}
											y={0}
											textAnchor="middle"
											dominantBaseline="central"
											className="fill-white font-bold pointer-events-none select-none"
											style={{ fontSize: `${nodeRadius * 0.75}px` }}
										>
											{node.name.substring(0, 2).toUpperCase()}
										</text>
									)}

									{/* Hover Name Badge */}
									{isHovered && (
										<text
											x={0}
											y={-nodeRadius - 10}
											textAnchor="middle"
											className="fill-white text-[10px] font-bold uppercase tracking-widest pointer-events-none drop-shadow-lg"
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
			<AnalyticsPanel />
		</div>
	);
}
