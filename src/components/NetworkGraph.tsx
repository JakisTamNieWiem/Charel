import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useGraphStore } from "@/store/useGraphStore";
import AnalyticsPanel from "./AnalyticsPanel";

interface GraphNode {
	id: string;
	name: string;
	groupId: string | null;
	avatar: string | null;
	x?: number;
	y?: number;
	fx?: number;
	fy?: number;
	color: string;
	initials: string;
	groupCx?: number;
	groupCy?: number;
}

interface GraphLink {
	source: string | GraphNode;
	target: string | GraphNode;
	typeId: string;
	color: string;
	// Perfect circular arc: center + radius of the arc's circle (passes through both nodes)
	arcCx?: number;
	arcCy?: number;
	arcR?: number;
}

interface GroupBound {
	id: string;
	name: string;
	color: string;
	cx: number;
	cy: number;
	radius: number;
	angle: number; // angle from center for radial label placement
}

interface ForceGraphMethods {
	zoom: (level: number, duration?: number) => void;
	centerAt: (x: number, y: number, duration?: number) => void;
	d3Reheat: () => void;
}

export default function NetworkGraph() {
	const allChars = useGraphStore((s) => s.characters);
	const relationships = useGraphStore((s) => s.relationships);
	const types = useGraphStore((s) => s.relationshipTypes);
	const groups = useGraphStore((s) => s.groups);
	const setSelectedCharId = useGraphStore((s) => s.setSelectedCharId);

	const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
	const animTime = useRef(0);

	const [hoveredNode, setHoveredNode] = useState<string | null>(null);
	const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

	const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
	const containerRef = useRef<HTMLDivElement>(null);

	// Avatar cache: loaded canvases + in-progress tracking to avoid duplicate Image() creation
	const avatarCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
	const avatarLoading = useRef<Set<string>>(new Set());

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (width > 0 && height > 0) setDimensions({ width, height });
			}
		});
		observer.observe(container);
		if (container.clientWidth > 0) setDimensions({ width: container.clientWidth, height: container.clientHeight });
		return () => observer.disconnect();
	}, []);

	// Animation loop: triggers re-renders at ~30fps while hovering for glow flow
	const [animTick, setAnimTick] = useState(0);
	useEffect(() => {
		if (!hoveredNode && !hoveredGroup) return;
		let raf: number;
		let last = 0;
		const tick = (now: number) => {
			if (now - last > 33) { // ~30fps
				animTime.current = now * 0.001;
				setAnimTick((t) => t + 1);
				last = now;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [hoveredNode, hoveredGroup]);

	// --- DATA DENORMALIZATION & PRE-CALC ---
	const { gData, groupBounds } = useMemo(() => {
		const typeMap = new Map(types.map((t) => [t.id, t]));
		const groupInfoMap = new Map(groups.map((g) => [g.id, g]));

		const groupMap = new Map<string | null, GraphNode[]>();
		for (const c of allChars) {
			const group = groupInfoMap.get(c.groupId || "");
			const nodes = groupMap.get(c.groupId) || [];
			nodes.push({
				...c,
				color: group?.color || "#ffffff",
				initials: c.name.substring(0, 2).toUpperCase(),
			});
			groupMap.set(c.groupId, nodes);
		}

		const sortedGroupIds = Array.from(groupMap.keys())

		const nodes: GraphNode[] = [];
		const bounds: GroupBound[] = [];
		const groupCount = sortedGroupIds.length;

		// Pre-compute each group's inner radius so we can size the outer circle
		const groupInnerRadii = sortedGroupIds.map((groupId) => {
			const count = groupMap.get(groupId)?.length || 0;
			return Math.max(80, count * 10);
		});
		
		const outerRadius = 600

		sortedGroupIds.forEach((groupId, gIdx) => {
			const groupNodes = groupMap.get(groupId) || [];
			const groupInfo = groupInfoMap.get(groupId || "");
			const groupAngle = (gIdx / groupCount) * 2 * Math.PI - Math.PI / 2; // start at top

			const gCx = groupCount === 1 ? 0 : Math.cos(groupAngle) * outerRadius;
			const gCy = groupCount === 1 ? 0 : Math.sin(groupAngle) * outerRadius;
			const innerRadius = groupInnerRadii[gIdx];

			groupNodes.forEach((node, nIdx) => {
				const nAngle = (nIdx / groupNodes.length) * 2 * Math.PI;
				const x = groupNodes.length === 1 ? gCx : gCx + Math.cos(nAngle) * innerRadius;
				const y = groupNodes.length === 1 ? gCy : gCy + Math.sin(nAngle) * innerRadius;
				node.fx = x; node.fy = y; node.x = x; node.y = y;
				node.groupCx = gCx; node.groupCy = gCy;
				nodes.push(node);
			});

			if (groupInfo) {
				bounds.push({
					id: groupInfo.id,
					name: groupInfo.name,
					color: groupInfo.color,
					cx: gCx, cy: gCy,
					radius: innerRadius + 40,
					angle: groupAngle,
				});
			}
		});

		const nodeMap = new Map(nodes.map(n => [n.id, n]));

		// One fixed arc radius = max pairwise distance between any two nodes
		let maxDist2 = 0;
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const dx = nodes[i].x! - nodes[j].x!, dy = nodes[i].y! - nodes[j].y!;
				maxDist2 = Math.max(maxDist2, dx * dx + dy * dy);
			}
		}
		const arcR = (Math.sqrt(maxDist2) || 1) * 0.50;

		const links: GraphLink[] = relationships
			.filter((r) => nodeMap.has(r.fromId) && nodeMap.has(r.toId))
			.map((r) => {
				const fromNode = nodeMap.get(r.fromId)!;
				const toNode = nodeMap.get(r.toId)!;
				const type = typeMap.get(r.typeId);
				const isCrossGroup = fromNode.groupId !== toNode.groupId;

				let arcCx: number | undefined;
				let arcCy: number | undefined;

				if (isCrossGroup) {
					const x1 = fromNode.x!, y1 = fromNode.y!;
					const x2 = toNode.x!, y2 = toNode.y!;
					const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
					const dx = x2 - x1, dy = y2 - y1;
					const dist = Math.sqrt(dx * dx + dy * dy);
					const halfD = dist / 2;

					if (halfD < arcR && dist > 0) {
						const h = Math.sqrt(arcR * arcR - halfD * halfD);
						const px = -dy / dist, py = dx / dist;
						const c1x = mx + h * px, c1y = my + h * py;
						const c2x = mx - h * px, c2y = my - h * py;
						const d1 = c1x * c1x + c1y * c1y;
						const d2 = c2x * c2x + c2y * c2y;
						// Angular distance determines routing direction
						const fromAngle = Math.atan2(y1, x1);
						const toAngle = Math.atan2(y2, x2);
						let delta = toAngle - fromAngle;
						while (delta > Math.PI) delta -= 2 * Math.PI;
						while (delta < -Math.PI) delta += 2 * Math.PI;
						// Small angle → inward (center farther from origin)
						// Large angle → outward (center closer to origin)
						const goOutward = Math.abs(delta) > Math.PI / 2;
						if (goOutward) {
							arcCx = d1 < d2 ? c1x : c2x;
							arcCy = d1 < d2 ? c1y : c2y;
						} else {
							arcCx = d1 > d2 ? c1x : c2x;
							arcCy = d1 > d2 ? c1y : c2y;
						}
					}
				}

				return {
					source: r.fromId, target: r.toId,
					arcCx, arcCy, arcR: arcCx != null ? arcR : undefined,
					typeId: r.typeId, color: type?.color || "#555",
				};
			});

		return { gData: { nodes, links }, groupBounds: bounds };
	}, [allChars, relationships, groups, types]);

	// Set of node IDs connected to the hovered node
	const connectedNodes = useMemo(() => {
		if (!hoveredNode) return new Set<string>();
		const connected = new Set<string>();
		for (const r of relationships) {
			if (r.fromId === hoveredNode) connected.add(r.toId);
			if (r.toId === hoveredNode) connected.add(r.fromId);
		}
		return connected;
	}, [hoveredNode, relationships]);


	// --- AVATAR PRE-RENDERING (tracks in-progress loads) ---
	const getAvatarCanvas = useCallback((avatar: string): HTMLCanvasElement | null => {
		const cached = avatarCache.current.get(avatar);
		if (cached) return cached;

		if (avatarLoading.current.has(avatar)) return null;
		avatarLoading.current.add(avatar);

		const img = new Image();
		img.src = avatar;
		img.onload = () => {
			const size = 256;
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.beginPath();
				ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
				ctx.clip();
				ctx.drawImage(img, 0, 0, size, size);
				avatarCache.current.set(avatar, canvas);
			}
			avatarLoading.current.delete(avatar);
		};
		img.onerror = () => {
			avatarLoading.current.delete(avatar);
		};
		return null;
	}, []);

	// --- RENDER CALLBACKS ---

	const nodeCanvasObject = useCallback(
		(nodeObj: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
			const node = nodeObj as GraphNode;
			const isHovered = node.id === hoveredNode;
			const isGroupHovered = node.groupId === hoveredGroup;
			const isConnected = connectedNodes.has(node.id);

			const x = node.x!, y = node.y!;
			const size = 20;

			// Only use dot fallback at extreme zoom-out
			if (globalScale < 0.05 && !isHovered && !isGroupHovered && !isConnected) {
				ctx.fillStyle = node.color;
				ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fill();
				return;
			}

			const isHighlighted = isHovered || isGroupHovered || isConnected;
			const opacity = (!hoveredNode && !hoveredGroup) ? 1 : (isHighlighted ? 1 : 0.05);
			ctx.globalAlpha = opacity;

			// Ring
			ctx.beginPath();
			ctx.arc(x, y, size, 0, 2 * Math.PI);
			ctx.fillStyle = "#141414";
			ctx.fill();
			ctx.lineWidth = Math.min((isHovered || isConnected) ? 3 / globalScale : 1.5 / globalScale, 4);
			ctx.strokeStyle = (isHovered || isConnected) ? "#fff" : node.color;
			ctx.stroke();

			// Avatar or initials - always visible
			const avatar = node.avatar ? getAvatarCanvas(node.avatar) : null;
			if (avatar) {
				ctx.drawImage(avatar, x - size + 1, y - size + 1, (size - 1) * 2, (size - 1) * 2);
			} else {
				ctx.fillStyle = "#fff";
				ctx.font = `bold ${Math.round(size * 0.8)}px sans-serif`;
				ctx.textAlign = "center"; ctx.textBaseline = "middle";
				ctx.fillText(node.initials, x, y);
			}

			// Label - radially outside the node relative to group center
			if (globalScale > 0.3) {
				const dx = x - (node.groupCx ?? 0);
				const dy = y - (node.groupCy ?? 0);
				const d = Math.sqrt(dx * dx + dy * dy) || 1;
				const cos = dx / d;
				const sin = dy / d;
				const textDist = size + Math.min(8 / globalScale, 20);
				const textX = x + textDist * cos;
				const textY = y + textDist * sin;
				const textAnchor: CanvasTextAlign = cos > 0.5 ? "left" : cos < -0.5 ? "right" : "center";
				const textBaseline: CanvasTextBaseline = sin > 0.5 ? "top" : sin < -0.5 ? "bottom" : "middle";
				ctx.font = `500 ${Math.min(Math.round(11 / globalScale), 40)}px sans-serif`;
				ctx.fillStyle = "#fff";
				ctx.textAlign = textAnchor;
				ctx.textBaseline = textBaseline;
				ctx.fillText(node.name, textX, textY);
			}
			ctx.globalAlpha = 1;
		},
		[hoveredNode, hoveredGroup, connectedNodes, getAvatarCanvas],
	);

	const linkCanvasObject = useCallback(
		(linkObj: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
			const start = linkObj.source;
			const end = linkObj.target;
			if (!start.x || !end.x) return;

			const isCrossGroup = start.groupId !== end.groupId;
			const isActive = (hoveredNode && (start.id === hoveredNode || end.id === hoveredNode)) ||
							(hoveredGroup && (start.groupId === hoveredGroup || end.groupId === hoveredGroup));

			const opacity = (!hoveredNode && !hoveredGroup) ? 0.25 : (isActive ? 0.8 : 0.02);
			if (opacity < 0.02) return;

			const sx = start.x, sy = start.y, ex = end.x, ey = end.y;

			// Compute control point (shared by base line and glow)
			let cpX: number | undefined, cpY: number | undefined;
			if (isCrossGroup) {
				const mx = (sx + ex) / 2, my = (sy + ey) / 2;
				const dx = ex - sx, dy = ey - sy;
				const curvature = 0.25;
				cpX = mx - dy * curvature;
				cpY = my + dx * curvature;
			}

			// Draw base line
			ctx.globalAlpha = opacity;
			ctx.strokeStyle = linkObj.color;
			ctx.lineWidth = isCrossGroup ? 0.6 / globalScale : 0.2 / globalScale;
			ctx.beginPath();
			ctx.moveTo(sx, sy);
			if (cpX != null) {
				ctx.quadraticCurveTo(cpX, cpY!, ex, ey);
			} else {
				ctx.lineTo(ex, ey);
			}
			ctx.stroke();

			// Smooth flowing glow on hover — light traveling through a cable
			if (isActive) {
				const center = (animTime.current * 0.25) % 1; // faster pulses
				const spread = 0.18; // shorter impulse
				const steps = 40;
				// Dim the glow near endpoints so stacking at nodes isn't too bright
				const edgeFade = (t: number) => {
					const d = Math.min(t, 1 - t); // 0 at endpoints, 0.5 at middle
					return Math.min(d / 0.12, 1); // fade over first/last 12%
				};

				const samplePoint = (t: number) => {
					if (cpX != null) {
						const t1 = 1 - t;
						return [t1 * t1 * sx + 2 * t1 * t * cpX + t * t * ex,
								t1 * t1 * sy + 2 * t1 * t * cpY! + t * t * ey];
					}
					return [sx + (ex - sx) * t, sy + (ey - sy) * t];
				};

				for (let i = 0; i < steps - 1; i++) {
					const t0 = i / (steps - 1);
					const t1 = (i + 1) / (steps - 1);
					const mid = (t0 + t1) / 2;
					let dist = Math.abs(mid - center);
					dist = Math.min(dist, 1 - dist);
					const intensity = Math.max(0, 1 - dist / spread);
					const glow = intensity * intensity * (3 - 2 * intensity) * edgeFade(mid);
					if (glow < 0.01) continue;

					const [x0, y0] = samplePoint(t0);
					const [x1, y1] = samplePoint(t1);

					ctx.beginPath();
					ctx.moveTo(x0, y0);
					ctx.lineTo(x1, y1);
					ctx.strokeStyle = linkObj.color;
					ctx.lineWidth = Math.max(3 / globalScale, 1);
					ctx.globalAlpha = glow * 0.5;
					ctx.shadowColor = linkObj.color;
					ctx.shadowBlur = Math.max(25 * glow / globalScale, 8 * glow);
					ctx.stroke();
				}
				ctx.shadowColor = "transparent";
				ctx.shadowBlur = 0;
			}

			ctx.globalAlpha = 1;
		},
		[hoveredNode, hoveredGroup, animTick]
	);

	const onRenderBg = useCallback(
		(ctx: CanvasRenderingContext2D, globalScale: number) => {
			for (const b of groupBounds) {
				const isHovered = hoveredGroup === b.id;
				if (globalScale < 0.03 && !isHovered) continue;

				ctx.globalAlpha = isHovered ? 0.15 : 0.035;
				ctx.fillStyle = b.color;
				ctx.beginPath(); ctx.arc(b.cx, b.cy, b.radius, 0, 2 * Math.PI); ctx.fill();

				if (isHovered || globalScale > 0.1) {
					ctx.globalAlpha = isHovered ? 0.9 : 0.2;
					ctx.fillStyle = b.color;
					ctx.font = `bold ${Math.min(Math.round(22 / globalScale), 60)}px Inter, sans-serif`;
					const cos = Math.cos(b.angle);
					const sin = Math.sin(b.angle);
					const labelDist = b.radius + Math.min(25 / globalScale, 50);
					const labelX = b.cx + labelDist * cos;
					const labelY = b.cy + labelDist * sin;
					ctx.textAlign = cos > 0.5 ? "left" : cos < -0.5 ? "right" : "center";
					ctx.textBaseline = sin > 0.5 ? "top" : sin < -0.5 ? "bottom" : "middle";
					ctx.fillText(b.name.toUpperCase(), labelX, labelY);
				}
			}
			ctx.globalAlpha = 1;
		},
		[groupBounds, hoveredGroup],
	);

	return (
		<div className="flex h-full w-full bg-[#0a0a0a]">
			<div ref={containerRef} className="flex-1 h-full overflow-hidden relative">
				<div className="absolute top-6 left-6 z-10 flex flex-col gap-2 pointer-events-none">
					{groups.map((g) => (
						<div key={g.id}
							className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 pointer-events-auto cursor-pointer transition-all hover:bg-white/10"
							onMouseEnter={() => setHoveredGroup(g.id)}
							onMouseLeave={() => setHoveredGroup(null)}>
							<div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
							<span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{g.name}</span>
						</div>
					))}
				</div>
				{dimensions.width > 0 && (
					<ForceGraph2D
						// @ts-expect-error typings
						ref={fgRef}
						width={dimensions.width} height={dimensions.height}
						graphData={gData}
						nodeCanvasObject={nodeCanvasObject}
						nodePointerAreaPaint={(nodeObj: object, color: string, ctx: CanvasRenderingContext2D) => {
							const node = nodeObj as GraphNode;
							ctx.fillStyle = color;
							ctx.beginPath();
							ctx.arc(node.x!, node.y!, 20, 0, 2 * Math.PI);
							ctx.fill();
						}}
						linkCanvasObject={linkCanvasObject}
						onRenderFramePre={onRenderBg}
						nodeLabel={() => ""}
						onNodeHover={(node) => setHoveredNode((node as GraphNode)?.id || null)}
						onNodeClick={(node) => setSelectedCharId((node as GraphNode).id)}
						cooldownTicks={0} warmupTicks={0}
						enableNodeDrag={false}
						enablePointerInteraction={true}
						enableZoomInteraction={true}
						enablePanInteraction={true}
					/>
				)}
			</div>
			<AnalyticsPanel />
		</div>
	);
}
