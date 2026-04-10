import { useCallback, useRef } from "react";
import { useGraphStore } from "@/store/useGraphStore";
import { Badge } from "./ui/badge";

// --- Types & Constants ---
const NODE_SIZE = 20;
const AVATAR_CACHE_SIZE = 256;
const GLOW_SPEED = 0.25;
const GLOW_SPREAD = 0.18;
const GLOW_STEPS = 40;
const GLOW_EDGE_FADE_RANGE = 0.12;

interface ComputedNode {
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

interface ComputedLink {
	sourceId: string;
	targetId: string;
	source: ComputedNode;
	target: ComputedNode;
	typeId: string;
	color: string;
	cpX?: number; // Control point X for quadratic curve
	cpY?: number; // Control point Y
}

interface ComputedGroup {
	id: string;
	name: string;
	color: string;
	cx: number;
	cy: number;
	radius: number;
	angle: number;
}

interface LayoutData {
	nodes: ComputedNode[];
	links: ComputedLink[];
	groups: ComputedGroup[];
	nodeMap: Map<string, ComputedNode>;
}

// --- Global Caches ---
const avatarCache = new Map<string, HTMLCanvasElement>();
const avatarLoading = new Set<string>();

function getAvatarCanvas(avatarUrl: string): HTMLCanvasElement | null {
	const cached = avatarCache.get(avatarUrl);
	if (cached) return cached;
	if (avatarLoading.has(avatarUrl)) return null;

	avatarLoading.add(avatarUrl);
	const img = new Image();
	img.crossOrigin = "anonymous";
	img.src = avatarUrl;

	img.onload = async () => {
		// 1. "Object-fit: cover" Math (Find the perfect center square to prevent stretching)
		const minSize = Math.min(img.width, img.height);
		const startX = (img.width - minSize) / 2;
		const startY = (img.height - minSize) / 2;

		// 2. Hardware-Accelerated High-Quality Downscaling
		// This forces the browser to use Lanczos/Bicubic scaling natively
		const bitmap = await createImageBitmap(
			img,
			startX,
			startY,
			minSize,
			minSize,
			{
				resizeWidth: AVATAR_CACHE_SIZE,
				resizeHeight: AVATAR_CACHE_SIZE,
				resizeQuality: "high", // This actually works, unlike the canvas context version!
			},
		);

		const canvas = document.createElement("canvas");
		canvas.width = AVATAR_CACHE_SIZE;
		canvas.height = AVATAR_CACHE_SIZE;
		const ctx = canvas.getContext("2d");

		if (ctx) {
			// 3. Draw a perfectly smooth anti-aliased circle first
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			ctx.arc(
				AVATAR_CACHE_SIZE / 2,
				AVATAR_CACHE_SIZE / 2,
				AVATAR_CACHE_SIZE / 2,
				0,
				2 * Math.PI,
			);
			ctx.fill();

			// 4. The Magic: Tell the canvas to ONLY draw the image where the circle exists
			ctx.globalCompositeOperation = "source-in";

			// 5. Draw the perfectly downscaled, perfectly squared bitmap
			ctx.drawImage(bitmap, 0, 0);

			avatarCache.set(avatarUrl, canvas);
		}
		avatarLoading.delete(avatarUrl);
	};

	img.onerror = () => avatarLoading.delete(avatarUrl);
	return null;
}

// --- Math Helpers ---
function radialTextAlign(cos: number): CanvasTextAlign {
	return cos > 0.5 ? "left" : cos < -0.5 ? "right" : "center";
}

function radialTextBaseline(sin: number): CanvasTextBaseline {
	return sin > 0.5 ? "top" : sin < -0.5 ? "bottom" : "middle";
}

function sampleQuadratic(
	sx: number,
	sy: number,
	cpX: number,
	cpY: number,
	ex: number,
	ey: number,
	t: number,
): [number, number] {
	const t1 = 1 - t;
	return [
		t1 * t1 * sx + 2 * t1 * t * cpX + t * t * ex,
		t1 * t1 * sy + 2 * t1 * t * cpY + t * t * ey,
	];
}

// --- Main Component ---
export default function NetworkGraph() {
	const allChars = useGraphStore((s) => s.characters);
	const relationships = useGraphStore((s) => s.relationships);
	const types = useGraphStore((s) => s.relationshipTypes);
	const groups = useGraphStore((s) => s.groups);
	const networkMode = useGraphStore((s) => s.networkMode);
	const setSelectedCharId = useGraphStore((s) => s.setSelectedCharId);

	// Engine state completely isolated from React re-renders
	const engineRef = useRef({
		transform: { x: 0, y: 0, k: 0.5 },
		width: 800,
		height: 600,
		theme: { bg: "#000", fg: "#fff", card: "#22" },
		hoveredNodeId: null as string | null,
		hoveredGroupId: null as string | null,
		connectedNodeIds: new Set<string>(),
		isDragging: false,
		hasCentered: false,
		pointerDownPos: { x: 0, y: 0 },
		lastPointerPos: { x: 0, y: 0 },
		layout: {
			nodes: [],
			links: [],
			groups: [],
			nodeMap: new Map(),
		} as LayoutData,
		animFrameId: 0,
	});

	// Deriving layout math once when data changes, outside the render loop
	const layout: LayoutData = (() => {
		const typeMap = new Map(types.map((t) => [t.id, t]));
		const groupInfoMap = new Map(groups.map((g) => [g.id, g]));

		const nodes: ComputedNode[] = [];
		const groupBounds: ComputedGroup[] = [];

		if (networkMode === "global") {
			const sortedChars = [...allChars].sort((a, b) =>
				a.name.localeCompare(b.name),
			);
			const radius = Math.max(400, sortedChars.length * 20);

			sortedChars.forEach((c, i) => {
				const group = groupInfoMap.get(c.groupId || "");
				const angle = (i / sortedChars.length) * 2 * Math.PI - Math.PI / 2;
				nodes.push({
					id: c.id,
					name: c.name,
					groupId: c.groupId,
					avatar: c.avatar,
					x: Math.cos(angle) * radius,
					y: Math.sin(angle) * radius,
					color: group?.color || "#ffffff",
					initials: c.name.substring(0, 2).toUpperCase(),
					groupCx: 0,
					groupCy: 0,
				});
			});
		} else {
			const groupMap = new Map<string | null, typeof allChars>();
			for (const c of allChars) {
				const entries = groupMap.get(c.groupId) || [];
				entries.push(c);
				groupMap.set(c.groupId, entries);
			}

			const sortedGroupIds = Array.from(groupMap.keys());
			const groupCount = sortedGroupIds.length;
			const outerRadius = 600;

			sortedGroupIds.forEach((groupId, gIdx) => {
				const groupNodes = groupMap.get(groupId) || [];
				const groupInfo = groupInfoMap.get(groupId || "");
				const innerRadius = Math.max(80, groupNodes.length * 10);

				const groupAngle = (gIdx / groupCount) * 2 * Math.PI - Math.PI / 2;
				const gCx = groupCount <= 1 ? 0 : Math.cos(groupAngle) * outerRadius;
				const gCy = groupCount <= 1 ? 0 : Math.sin(groupAngle) * outerRadius;

				groupNodes.forEach((c, nIdx) => {
					const nAngle = (nIdx / groupNodes.length) * 2 * Math.PI;
					nodes.push({
						id: c.id,
						name: c.name,
						groupId: c.groupId,
						avatar: c.avatar,
						x:
							groupNodes.length === 1
								? gCx
								: gCx + Math.cos(nAngle) * innerRadius,
						y:
							groupNodes.length === 1
								? gCy
								: gCy + Math.sin(nAngle) * innerRadius,
						color: groupInfo?.color || "#ffffff",
						initials: c.name.substring(0, 2).toUpperCase(),
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

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const links: ComputedLink[] = [];
		for (const r of relationships) {
			const source = nodeMap.get(r.fromId);
			const target = nodeMap.get(r.toId);
			if (!source || !target) continue;

			const type = typeMap.get(r.typeId);
			const isCrossGroup =
				networkMode === "group" ? source.groupId !== target.groupId : true;

			let cpX: number | undefined;
			let cpY: number | undefined;

			if (isCrossGroup) {
				const mx = (source.x + target.x) / 2;
				const my = (source.y + target.y) / 2;
				const dx = target.x - source.x;
				const dy = target.y - source.y;
				// Beautiful arc sweeping out based on relative distance
				cpX = mx - dy * 0.25;
				cpY = my + dx * 0.25;
			}

			links.push({
				sourceId: source.id,
				targetId: target.id,
				source,
				target,
				typeId: r.typeId,
				color: type?.color || "#555",
				cpX,
				cpY,
			});
		}

		return { nodes, links, groups: groupBounds, nodeMap };
	})();

	// Sync layout to engine synchronously without triggering side-effects
	engineRef.current.layout = layout;

	// Center view on first load if dimensions are established
	if (!engineRef.current.hasCentered && engineRef.current.width > 0) {
		engineRef.current.transform.x = engineRef.current.width / 2;
		engineRef.current.transform.y = engineRef.current.height / 2;
		engineRef.current.hasCentered = true;
	}

	// --- Canvas Setup & Binding using React 19 Ref Callback Cleanup ---
	const containerRef = useCallback(
		(el: HTMLDivElement | null) => {
			if (!el) return;
			const engine = engineRef.current;

			// 1. Setup automatic canvas resizing
			const canvas = el.querySelector("canvas");
			if (!canvas) return;

			const ro = new ResizeObserver((entries) => {
				const rect = entries[0].contentRect;
				const dpr = window.devicePixelRatio || 1; // Get screen density

				engine.width = rect.width;
				engine.height = rect.height;

				// Internal resolution (high quality)
				canvas.width = rect.width * dpr;
				canvas.height = rect.height * dpr;

				// CSS display size (normal size)
				canvas.style.width = `${rect.width}px`;
				canvas.style.height = `${rect.height}px`;

				if (!engine.hasCentered) {
					engine.transform.x = rect.width / 2;
					engine.transform.y = rect.height / 2;
					engine.hasCentered = true;
				}
			});
			ro.observe(el);

			// 2. Setup theme observation completely natively
			const updateTheme = () => {
				const s = getComputedStyle(document.documentElement);
				engine.theme = {
					bg: s.getPropertyValue("--background").trim(),
					fg: s.getPropertyValue("--foreground").trim(),
					card: s.getPropertyValue("--card").trim(),
				};
			};
			updateTheme();
			const themeObs = new MutationObserver(updateTheme);
			themeObs.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class"],
			});

			// 3. Pointer & Pan/Zoom Event Logic
			const getEventPos = (e: MouseEvent | PointerEvent) => {
				const rect = canvas.getBoundingClientRect();
				return { x: e.clientX - rect.left, y: e.clientY - rect.top };
			};

			const onWheel = (e: WheelEvent) => {
				e.preventDefault();
				const pos = getEventPos(e);
				const { x, y, k } = engine.transform;

				const scaleAdj = Math.exp(-e.deltaY * 0.002);
				const newK = Math.min(Math.max(k * scaleAdj, 0.03), 4);

				engine.transform.x = pos.x - (pos.x - x) * (newK / k);
				engine.transform.y = pos.y - (pos.y - y) * (newK / k);
				engine.transform.k = newK;
			};

			const updateHoverState = (mouseX: number, mouseY: number) => {
				const { x: tx, y: ty, k } = engine.transform;
				const wX = (mouseX - tx) / k;
				const wY = (mouseY - ty) / k;

				let hitNode: string | null = null;

				for (const node of engine.layout.nodes) {
					const dx = node.x - wX;
					const dy = node.y - wY;
					if (dx * dx + dy * dy <= NODE_SIZE * NODE_SIZE) {
						hitNode = node.id;
						break;
					}
				}

				engine.hoveredNodeId = hitNode;

				engine.connectedNodeIds.clear();
				if (hitNode) {
					for (const link of engine.layout.links) {
						if (link.sourceId === hitNode)
							engine.connectedNodeIds.add(link.targetId);
						if (link.targetId === hitNode)
							engine.connectedNodeIds.add(link.sourceId);
					}
				}

				canvas.style.cursor = hitNode ? "pointer" : "default";
			};

			const onPointerDown = (e: PointerEvent) => {
				engine.isDragging = true;
				engine.lastPointerPos = { x: e.clientX, y: e.clientY };
				engine.pointerDownPos = { x: e.clientX, y: e.clientY };

				canvas.setPointerCapture(e.pointerId);
				canvas.style.cursor = "grabbing";
			};

			const onPointerMove = (e: PointerEvent) => {
				if (engine.isDragging) {
					// 2. Calculate the exact delta manually
					const dx = e.clientX - engine.lastPointerPos.x;
					const dy = e.clientY - engine.lastPointerPos.y;

					// 3. Apply it
					engine.transform.x += dx;
					engine.transform.y += dy;

					// 4. Reset for the next frame
					engine.lastPointerPos = { x: e.clientX, y: e.clientY };
				} else {
					const rect = canvas.getBoundingClientRect();
					updateHoverState(e.clientX - rect.left, e.clientY - rect.top);
				}
			};

			const onPointerUp = (e: PointerEvent) => {
				engine.isDragging = false;
				canvas.releasePointerCapture(e.pointerId);

				const pos = getEventPos(e);
				const dx = pos.x - engine.pointerDownPos.x;
				const dy = pos.y - engine.pointerDownPos.y;

				// If it was a click (not a drag)
				if (dx * dx + dy * dy < 25 && engine.hoveredNodeId) {
					setSelectedCharId(engine.hoveredNodeId);
				}
				updateHoverState(pos.x, pos.y);
			};

			canvas.addEventListener("wheel", onWheel, { passive: false });
			canvas.addEventListener("pointerdown", onPointerDown);
			canvas.addEventListener("pointermove", onPointerMove);
			canvas.addEventListener("pointerup", onPointerUp);

			// 4. Dedicated 60FPS High-Performance Render Loop
			const ctx = canvas.getContext("2d");

			const render = () => {
				engine.animFrameId = requestAnimationFrame(render);
				if (!ctx) return;

				const dpr = window.devicePixelRatio || 1;

				// Enable high-quality image scaling
				//ctx.imageSmoothingEnabled = true;
				//ctx.imageSmoothingQuality = "medium";

				ctx.clearRect(0, 0, engine.width, engine.height);

				const { x: tx, y: ty, k } = engine.transform;
				const lyt = engine.layout;
				const { theme, hoveredNodeId, hoveredGroupId, connectedNodeIds } =
					engine;

				ctx.save();
				// 1. Scale everything up by the device pixel ratio first
				ctx.scale(dpr, dpr);

				// 2. Then apply the pan and zoom transforms
				ctx.translate(tx, ty);
				ctx.scale(k, k);

				// A. Draw Groups Backgrounds
				for (const b of lyt.groups) {
					const isHovered = hoveredGroupId === b.id;
					if (k < 0.03 && !isHovered) continue;

					ctx.globalAlpha = isHovered ? 0.15 : 0.035;
					ctx.fillStyle = b.color;
					ctx.beginPath();
					ctx.arc(b.cx, b.cy, b.radius, 0, 2 * Math.PI);
					ctx.fill();

					if (isHovered || k > 0.1) {
						ctx.globalAlpha = isHovered ? 0.9 : 0.4;
						ctx.fillStyle = b.color;
						ctx.font = `bold ${Math.min(Math.round(22 / k), 60)}px Inter, sans-serif`;
						const cos = Math.cos(b.angle);
						const sin = Math.sin(b.angle);
						const labelDist = b.radius + Math.min(25 / k, 50);
						ctx.textAlign = radialTextAlign(cos);
						ctx.textBaseline = radialTextBaseline(sin);
						ctx.fillText(
							b.name.toUpperCase(),
							b.cx + labelDist * cos,
							b.cy + labelDist * sin,
						);
					}
				}

				// B. Draw Links & Particles
				const timeSeconds = performance.now() * 0.001;
				const glowCenter = (timeSeconds * GLOW_SPEED) % 1;

				for (const link of lyt.links) {
					const sx = Math.round(link.source.x);
					const sy = Math.round(link.source.y);
					const ex = Math.round(link.target.x);
					const ey = Math.round(link.target.y);

					const isNodeActive = Boolean(
						hoveredNodeId &&
							(link.sourceId === hoveredNodeId ||
								link.targetId === hoveredNodeId),
					);
					const isGroupActive = Boolean(
						hoveredGroupId &&
							(link.source.groupId === hoveredGroupId ||
								link.target.groupId === hoveredGroupId),
					);
					const isActive = isNodeActive || isGroupActive;

					const opacity =
						!hoveredNodeId && !hoveredGroupId ? 0.25 : isActive ? 0.8 : 0.02;
					if (opacity < 0.02) continue;

					ctx.globalAlpha = opacity;
					ctx.strokeStyle = link.color;
					ctx.lineWidth = link.cpX != null ? 0.6 / k : 0.2 / k;

					ctx.beginPath();
					ctx.moveTo(sx, sy);
					if (link.cpX != null && link.cpY != null) {
						ctx.quadraticCurveTo(
							Math.round(link.cpX),
							Math.round(link.cpY),
							ex,
							ey,
						);
					} else {
						ctx.lineTo(ex, ey);
					}
					ctx.stroke();

					// Particles logic - ONLY for node hover (performance optimization)
					if (isNodeActive) {
						for (let i = 0; i < GLOW_STEPS - 1; i++) {
							const t0 = i / (GLOW_STEPS - 1);
							const t1 = (i + 1) / (GLOW_STEPS - 1);
							const mid = (t0 + t1) / 2;

							let dist = Math.abs(mid - glowCenter);
							dist = Math.min(dist, 1 - dist);
							const intensity = Math.max(0, 1 - dist / GLOW_SPREAD);
							const edgeFade = Math.min(
								Math.min(mid, 1 - mid) / GLOW_EDGE_FADE_RANGE,
								1,
							);
							const glow =
								intensity * intensity * (3 - 2 * intensity) * edgeFade;
							if (glow < 0.01) continue;

							const [x0, y0] =
								link.cpX != null
									? sampleQuadratic(sx, sy, link.cpX, link.cpY ?? 0, ex, ey, t0)
									: [sx + (ex - sx) * t0, sy + (ey - sy) * t0];
							const [x1, y1] =
								link.cpX != null
									? sampleQuadratic(sx, sy, link.cpX, link.cpY ?? 0, ex, ey, t1)
									: [sx + (ex - sx) * t1, sy + (ey - sy) * t1];

							ctx.beginPath();
							ctx.moveTo(x0, y0);
							ctx.lineTo(x1, y1);
							ctx.strokeStyle = link.color;
							ctx.lineWidth = Math.max(3 / k, 1);
							ctx.globalAlpha = glow * 0.5;
							ctx.shadowColor = link.color;
							ctx.shadowBlur = Math.max((25 * glow) / k, 8 * glow);
							ctx.stroke();
						}
						ctx.shadowColor = "transparent";
						ctx.shadowBlur = 0;
					}
				}

				// C. Draw Nodes
				for (const node of lyt.nodes) {
					const isHovered = node.id === hoveredNodeId;
					const isGroupHovered = node.groupId === hoveredGroupId;
					const isConnected = connectedNodeIds.has(node.id);
					const isHighlighted = isHovered || isGroupHovered || isConnected;

					const rx = Math.round(node.x);
					const ry = Math.round(node.y);

					if (k < 0.05 && !isHighlighted) {
						ctx.fillStyle = node.color;
						ctx.beginPath();
						ctx.arc(rx, ry, 3, 0, 2 * Math.PI);
						ctx.fill();
						continue;
					}

					ctx.globalAlpha =
						!hoveredNodeId && !hoveredGroupId ? 1 : isHighlighted ? 1 : 0.05;

					// Background
					ctx.beginPath();
					ctx.arc(rx, ry, NODE_SIZE, 0, 2 * Math.PI);
					ctx.fillStyle = theme.card;
					ctx.fill();

					// Border
					ctx.lineWidth = Math.min(
						isHovered || isConnected ? 3 / k : 1.5 / k,
						4,
					);
					ctx.strokeStyle = isHovered || isConnected ? theme.fg : node.color;
					ctx.stroke();

					// Avatar
					const avatarCanvas = node.avatar
						? getAvatarCanvas(node.avatar)
						: null;
					if (avatarCanvas) {
						ctx.drawImage(
							avatarCanvas,
							rx - NODE_SIZE + 1,
							ry - NODE_SIZE + 1,
							(NODE_SIZE - 1) * 2,
							(NODE_SIZE - 1) * 2,
						);
					} else {
						ctx.fillStyle = theme.fg;
						ctx.font = `bold ${Math.round(NODE_SIZE * 0.8)}px sans-serif`;
						ctx.textAlign = "center";
						ctx.textBaseline = "middle";
						ctx.fillText(node.initials, rx, ry);
					}

					if (k > 0.3) {
						const dx = rx - node.groupCx;
						const dy = ry - node.groupCy;
						const d = Math.sqrt(dx * dx + dy * dy) || 1;
						const cos = dx / d;
						const sin = dy / d;
						const textDist = NODE_SIZE + Math.min(8 / k, 20);

						ctx.font = `500 ${Math.min(Math.round(11 / k), 40)}px sans-serif`;
						ctx.fillStyle = theme.fg;
						ctx.textAlign = radialTextAlign(cos);
						ctx.textBaseline = radialTextBaseline(sin);
						ctx.fillText(node.name, rx + textDist * cos, ry + textDist * sin);
					}
				}

				ctx.restore();
			};
			engine.animFrameId = requestAnimationFrame(render);

			// Cleanup strictly on unmount
			return () => {
				ro.disconnect();
				themeObs.disconnect();
				canvas.removeEventListener("wheel", onWheel);
				canvas.removeEventListener("pointerdown", onPointerDown);
				canvas.removeEventListener("pointermove", onPointerMove);
				canvas.removeEventListener("pointerup", onPointerUp);
				cancelAnimationFrame(engine.animFrameId);
			};
		},
		[setSelectedCharId],
	);

	return (
		<div
			className="relative flex-1 h-full w-full flex justify-end items-center overflow-hidden"
			ref={containerRef}
		>
			<canvas className="absolute inset-0 pointer-events-auto block" />

			{/* Overlays */}
			{networkMode === "group" && (
				<div className="absolute top-6 left-6 z-10 flex flex-col gap-2 pointer-events-none">
					{groups.map((g) => (
						<div
							key={g.id}
							className="flex items-center gap-2 bg-card/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-foreground/5 pointer-events-auto cursor-pointer transition-all hover:bg-foreground/10"
							onMouseEnter={() => {
								engineRef.current.hoveredGroupId = g.id;
							}}
							onMouseLeave={() => {
								engineRef.current.hoveredGroupId = null;
							}}
						>
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: g.color }}
							/>
							<span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
								{g.name}
							</span>
						</div>
					))}
				</div>
			)}

			{/* Legend Container */}
			<div className="z-10 w-min p-6 flex flex-col flex-wrap-reverse gap-3 pointer-events-none">
				{types.map((type) => (
					<Badge
						variant={"secondary"}
						key={type.id}
						style={{ "--badge-color": type.color } as React.CSSProperties}
						className="self-start p-2.5 pr-1 bg-card/40 backdrop-blur-md pointer-events-auto border border-foreground/5 transition-all hover:bg-foreground/10"
					>
						<span className="text-[10px] uppercase font-bold tracking-widest">
							{type.label}
						</span>
						<div
							className="size-3 rounded-full ml-2"
							style={{ backgroundColor: type.color }}
						/>
					</Badge>
				))}
			</div>
		</div>
	);
}
