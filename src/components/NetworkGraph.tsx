import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	type AvatarQualityTier,
	buildNetworkLayout,
	findNodeAtPosition,
	getAvatarSpriteSpec,
	getViewportBounds,
	isCircleVisible,
	isLinkVisible,
	type LayoutData,
	NODE_SIZE,
} from "@/lib/network-graph";
import { useGraphStore } from "@/store/useGraphStore";
import { Badge } from "./ui/badge";

const GLOW_SPEED = 0.25;
const GLOW_SPREAD = 0.18;
const GLOW_STEPS = 40;
const GLOW_EDGE_FADE_RANGE = 0.12;
const QUALITY_SETTLE_DELAY_MS = 90;
const INITIAL_AVATAR_SUPPRESSION_MS = 180;

interface AvatarSpriteSpec {
	cacheKey: string;
	size: number;
}

type EngineState = {
	transform: { x: number; y: number; k: number };
	width: number;
	height: number;
	theme: { bg: string; fg: string; card: string };
	hoveredNodeId: string | null;
	hoveredGroupId: string | null;
	connectedNodeIds: Set<string>;
	isDragging: boolean;
	isInteracting: boolean;
	hasCentered: boolean;
	avatarQualityTier: AvatarQualityTier;
	pointerDownPos: { x: number; y: number };
	lastPointerPos: { x: number; y: number };
	layout: LayoutData;
	baseCanvas: HTMLCanvasElement | null;
	baseCtx: CanvasRenderingContext2D | null;
	fxCanvas: HTMLCanvasElement | null;
	fxCtx: CanvasRenderingContext2D | null;
	baseDirty: boolean;
	fxDirty: boolean;
	activeEffects: boolean;
	animFrameId: number;
	settleTimer: number | null;
	suppressAvatarFallbacksUntil: number;
};

const avatarCache = new Map<string, HTMLCanvasElement>();
const avatarLoading = new Set<string>();
function getAvatarSprite(
	avatarUrl: string,
	spec: AvatarSpriteSpec,
	onReady: () => void,
): HTMLCanvasElement | null {
	const cached = avatarCache.get(spec.cacheKey);

	if (cached) {
		return cached;
	}

	if (avatarLoading.has(spec.cacheKey)) {
		return null;
	}

	avatarLoading.add(spec.cacheKey);

	const img = new Image();
	img.crossOrigin = "anonymous";
	img.src = avatarUrl;

	img.onload = async () => {
		try {
			const minSize = Math.min(img.width, img.height);
			const startX = (img.width - minSize) / 2;
			const startY = (img.height - minSize) / 2;

			const bitmap = await createImageBitmap(
				img,
				startX,
				startY,
				minSize,
				minSize,
				{
					resizeWidth: spec.size,
					resizeHeight: spec.size,
					resizeQuality: "high",
				},
			);

			const canvas = document.createElement("canvas");
			canvas.width = spec.size;
			canvas.height = spec.size;

			const ctx = canvas.getContext("2d");

			if (ctx) {
				ctx.fillStyle = "#ffffff";
				ctx.beginPath();
				ctx.arc(spec.size / 2, spec.size / 2, spec.size / 2, 0, 2 * Math.PI);
				ctx.fill();
				ctx.globalCompositeOperation = "source-in";
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = "high";
				ctx.drawImage(bitmap, 0, 0);
				avatarCache.set(spec.cacheKey, canvas);
				onReady();
			}
		} finally {
			avatarLoading.delete(spec.cacheKey);
		}
	};

	img.onerror = () => {
		avatarLoading.delete(spec.cacheKey);
	};

	return null;
}

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

function drawBaseLayer(engine: EngineState, scheduleRender: () => void) {
	const ctx = engine.baseCtx;
	const canvas = engine.baseCanvas;

	if (!ctx || !canvas || engine.width <= 0 || engine.height <= 0) {
		return;
	}

	const dpr = window.devicePixelRatio || 1;
	const { x: tx, y: ty, k } = engine.transform;
	const bounds = getViewportBounds(
		engine.transform,
		engine.width,
		engine.height,
	);
	const { theme, hoveredNodeId, hoveredGroupId, connectedNodeIds } = engine;
	const suppressAvatarFallbacks =
		performance.now() < engine.suppressAvatarFallbacksUntil;

	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.save();
	ctx.scale(dpr, dpr);
	ctx.translate(tx, ty);
	ctx.scale(k, k);

	for (const group of engine.layout.groups) {
		const isHovered = hoveredGroupId === group.id;

		if (
			(k < 0.03 && !isHovered) ||
			!isCircleVisible(bounds, group.cx, group.cy, group.radius + 60)
		) {
			continue;
		}

		ctx.globalAlpha = isHovered ? 0.15 : 0.035;
		ctx.fillStyle = group.color;
		ctx.beginPath();
		ctx.arc(group.cx, group.cy, group.radius, 0, 2 * Math.PI);
		ctx.fill();

		if (isHovered || k > 0.1) {
			ctx.globalAlpha = isHovered ? 0.9 : 0.4;
			ctx.fillStyle = group.color;
			ctx.font = `bold ${Math.min(Math.round(22 / k), 60)}px Inter, sans-serif`;

			const cos = Math.cos(group.angle);
			const sin = Math.sin(group.angle);
			const labelDist = group.radius + Math.min(25 / k, 50);

			ctx.textAlign = radialTextAlign(cos);
			ctx.textBaseline = radialTextBaseline(sin);
			ctx.fillText(
				group.name.toUpperCase(),
				group.cx + labelDist * cos,
				group.cy + labelDist * sin,
			);
		}
	}

	for (const link of engine.layout.links) {
		if (!isLinkVisible(bounds, link, 32)) {
			continue;
		}

		const isNodeActive = Boolean(
			hoveredNodeId &&
				(link.sourceId === hoveredNodeId || link.targetId === hoveredNodeId),
		);
		const isGroupActive = Boolean(
			hoveredGroupId &&
				(link.source.groupId === hoveredGroupId ||
					link.target.groupId === hoveredGroupId),
		);
		const isActive = isNodeActive || isGroupActive;

		const opacity =
			!hoveredNodeId && !hoveredGroupId ? 0.25 : isActive ? 0.8 : 0.02;

		if (opacity < 0.02) {
			continue;
		}

		ctx.globalAlpha = opacity;
		ctx.strokeStyle = link.color;
		ctx.lineWidth = link.cpX != null ? 0.6 / k : 0.2 / k;
		ctx.beginPath();
		ctx.moveTo(Math.round(link.source.x), Math.round(link.source.y));

		if (link.cpX != null && link.cpY != null) {
			ctx.quadraticCurveTo(
				Math.round(link.cpX),
				Math.round(link.cpY),
				Math.round(link.target.x),
				Math.round(link.target.y),
			);
		} else {
			ctx.lineTo(Math.round(link.target.x), Math.round(link.target.y));
		}

		ctx.stroke();
	}

	ctx.imageSmoothingEnabled = engine.avatarQualityTier === "settled";
	ctx.imageSmoothingQuality =
		engine.avatarQualityTier === "settled" ? "high" : "low";

	for (const node of engine.layout.nodes) {
		const isHovered = node.id === hoveredNodeId;
		const isGroupHovered = node.groupId === hoveredGroupId;
		const isConnected = connectedNodeIds.has(node.id);
		const isHighlighted = isHovered || isGroupHovered || isConnected;

		if (
			!isCircleVisible(bounds, node.x, node.y, NODE_SIZE + 48) &&
			(!isHighlighted || k < 0.3)
		) {
			continue;
		}

		const rx = Math.round(node.x);
		const ry = Math.round(node.y);

		if (k < 0.05 && !isHighlighted) {
			ctx.globalAlpha = 1;
			ctx.fillStyle = node.color;
			ctx.beginPath();
			ctx.arc(rx, ry, 3, 0, 2 * Math.PI);
			ctx.fill();
			continue;
		}

		ctx.globalAlpha =
			!hoveredNodeId && !hoveredGroupId ? 1 : isHighlighted ? 1 : 0.05;

		ctx.beginPath();
		ctx.arc(rx, ry, NODE_SIZE, 0, 2 * Math.PI);
		ctx.fillStyle = theme.card;
		ctx.fill();

		ctx.lineWidth = Math.min(isHovered || isConnected ? 3 / k : 1.5 / k, 4);
		ctx.strokeStyle = isHovered || isConnected ? theme.fg : node.color;
		ctx.stroke();

		const avatarSpec = node.avatar
			? getAvatarSpriteSpec(node.avatar, engine.avatarQualityTier, k, dpr)
			: null;
		const avatarSprite =
			node.avatar && avatarSpec
				? getAvatarSprite(node.avatar, avatarSpec, () => {
						engine.baseDirty = true;
						scheduleRender();
					})
				: null;

		if (avatarSprite) {
			ctx.drawImage(
				avatarSprite,
				rx - NODE_SIZE + 1,
				ry - NODE_SIZE + 1,
				(NODE_SIZE - 1) * 2,
				(NODE_SIZE - 1) * 2,
			);
		} else if (!suppressAvatarFallbacks) {
			ctx.fillStyle = theme.fg;
			ctx.font = `bold ${Math.round(NODE_SIZE * 0.8)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(node.initials, rx, ry);
		}

		if (k > 0.3) {
			const dx = rx - node.groupCx;
			const dy = ry - node.groupCy;
			const distance = Math.sqrt(dx * dx + dy * dy) || 1;
			const cos = dx / distance;
			const sin = dy / distance;
			const textDist = NODE_SIZE + Math.min(8 / k, 20);

			ctx.font = `500 ${Math.min(Math.round(11 / k), 40)}px sans-serif`;
			ctx.fillStyle = theme.fg;
			ctx.textAlign = radialTextAlign(cos);
			ctx.textBaseline = radialTextBaseline(sin);
			ctx.fillText(node.name, rx + textDist * cos, ry + textDist * sin);
		}
	}

	ctx.restore();
}

function prewarmVisibleAvatarSprites(
	engine: EngineState,
	scheduleRender: () => void,
) {
	if (engine.width <= 0 || engine.height <= 0) {
		return;
	}

	const dpr = window.devicePixelRatio || 1;
	const bounds = getViewportBounds(
		engine.transform,
		engine.width,
		engine.height,
	);
	let requestedSprite = false;

	for (const node of engine.layout.nodes) {
		if (
			!node.avatar ||
			!isCircleVisible(bounds, node.x, node.y, NODE_SIZE + 48)
		) {
			continue;
		}

		for (const tier of ["interactive", "settled"] as const) {
			const spec = getAvatarSpriteSpec(
				node.avatar,
				tier,
				engine.transform.k,
				dpr,
			);

			if (avatarCache.has(spec.cacheKey)) {
				continue;
			}

			requestedSprite = true;
			getAvatarSprite(node.avatar, spec, () => {
				engine.baseDirty = true;
				scheduleRender();
			});
		}
	}

	if (requestedSprite) {
		engine.suppressAvatarFallbacksUntil =
			performance.now() + INITIAL_AVATAR_SUPPRESSION_MS;
	}
}

function drawFxLayer(engine: EngineState) {
	const ctx = engine.fxCtx;
	const canvas = engine.fxCanvas;

	if (!ctx || !canvas) {
		return;
	}

	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (!engine.activeEffects || !engine.hoveredNodeId) {
		return;
	}

	const dpr = window.devicePixelRatio || 1;
	const { x: tx, y: ty, k } = engine.transform;
	const hoveredNodeId = engine.hoveredNodeId;
	const bounds = getViewportBounds(
		engine.transform,
		engine.width,
		engine.height,
	);
	const timeSeconds = performance.now() * 0.001;
	const glowCenter = (timeSeconds * GLOW_SPEED) % 1;

	ctx.save();
	ctx.scale(dpr, dpr);
	ctx.translate(tx, ty);
	ctx.scale(k, k);

	for (const link of engine.layout.links) {
		if (hoveredNodeId !== link.sourceId && hoveredNodeId !== link.targetId) {
			continue;
		}

		if (!isLinkVisible(bounds, link, 32)) {
			continue;
		}

		const sx = Math.round(link.source.x);
		const sy = Math.round(link.source.y);
		const ex = Math.round(link.target.x);
		const ey = Math.round(link.target.y);

		for (let index = 0; index < GLOW_STEPS - 1; index += 1) {
			const t0 = index / (GLOW_STEPS - 1);
			const t1 = (index + 1) / (GLOW_STEPS - 1);
			const mid = (t0 + t1) / 2;

			let dist = Math.abs(mid - glowCenter);
			dist = Math.min(dist, 1 - dist);

			const intensity = Math.max(0, 1 - dist / GLOW_SPREAD);
			const edgeFade = Math.min(
				Math.min(mid, 1 - mid) / GLOW_EDGE_FADE_RANGE,
				1,
			);
			const glow = intensity * intensity * (3 - 2 * intensity) * edgeFade;

			if (glow < 0.01) {
				continue;
			}

			const [x0, y0] =
				link.cpX != null && link.cpY != null
					? sampleQuadratic(sx, sy, link.cpX, link.cpY, ex, ey, t0)
					: [sx + (ex - sx) * t0, sy + (ey - sy) * t0];
			const [x1, y1] =
				link.cpX != null && link.cpY != null
					? sampleQuadratic(sx, sy, link.cpX, link.cpY, ex, ey, t1)
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
	}

	ctx.shadowColor = "transparent";
	ctx.shadowBlur = 0;
	ctx.restore();
}

export default function NetworkGraph() {
	const allChars = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const types = useGraphStore((state) => state.relationshipTypes);
	const groups = useGraphStore((state) => state.groups);
	const networkMode = useGraphStore((state) => state.networkMode);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);

	const engineRef = useRef<EngineState>({
		transform: { x: 0, y: 0, k: 0.5 },
		width: 0,
		height: 0,
		theme: { bg: "#000", fg: "#fff", card: "#22" },
		hoveredNodeId: null,
		hoveredGroupId: null,
		connectedNodeIds: new Set<string>(),
		isDragging: false,
		isInteracting: false,
		hasCentered: false,
		avatarQualityTier: "settled",
		pointerDownPos: { x: 0, y: 0 },
		lastPointerPos: { x: 0, y: 0 },
		layout: {
			nodes: [],
			links: [],
			groups: [],
			nodeMap: new Map(),
		},
		baseCanvas: null,
		baseCtx: null,
		fxCanvas: null,
		fxCtx: null,
		baseDirty: true,
		fxDirty: true,
		activeEffects: false,
		animFrameId: 0,
		settleTimer: null,
		suppressAvatarFallbacksUntil: 0,
	});
	const scheduleRenderRef = useRef<(() => void) | null>(null);

	const layout = useMemo<LayoutData>(() => {
		return buildNetworkLayout(
			allChars,
			relationships,
			types,
			groups,
			networkMode,
		);
	}, [allChars, groups, networkMode, relationships, types]);

	useEffect(() => {
		const engine = engineRef.current;
		engine.layout = layout;
		engine.baseDirty = true;
		engine.fxDirty = true;
		if (scheduleRenderRef.current) {
			prewarmVisibleAvatarSprites(engine, scheduleRenderRef.current);
		}
		scheduleRenderRef.current?.();
	}, [layout]);

	const containerRef = useCallback(
		(element: HTMLDivElement | null) => {
			if (!element) {
				return;
			}

			const engine = engineRef.current;
			const baseCanvas = element.querySelector<HTMLCanvasElement>(
				"canvas[data-layer='base']",
			);
			const fxCanvas = element.querySelector<HTMLCanvasElement>(
				"canvas[data-layer='fx']",
			);

			if (!baseCanvas || !fxCanvas) {
				return;
			}

			engine.baseCanvas = baseCanvas;
			engine.fxCanvas = fxCanvas;
			engine.baseCtx = baseCanvas.getContext("2d");
			engine.fxCtx = fxCanvas.getContext("2d");

			const scheduleRender = () => {
				if (engine.animFrameId) {
					return;
				}

				engine.animFrameId = window.requestAnimationFrame(() => {
					engine.animFrameId = 0;

					if (engine.baseDirty) {
						drawBaseLayer(engine, scheduleRender);
						engine.baseDirty = false;
					}

					if (engine.fxDirty || engine.activeEffects) {
						drawFxLayer(engine);
						engine.fxDirty = false;
					}

					if (engine.activeEffects) {
						scheduleRender();
					}
				});
			};

			scheduleRenderRef.current = scheduleRender;

			const markDirty = (base = true, fx = true) => {
				if (base) {
					engine.baseDirty = true;
				}

				if (fx) {
					engine.fxDirty = true;
				}

				scheduleRender();
			};

			const recomputeConnectedNodeIds = () => {
				engine.connectedNodeIds.clear();

				if (!engine.hoveredNodeId) {
					return;
				}

				for (const link of engine.layout.links) {
					if (link.sourceId === engine.hoveredNodeId) {
						engine.connectedNodeIds.add(link.targetId);
					}

					if (link.targetId === engine.hoveredNodeId) {
						engine.connectedNodeIds.add(link.sourceId);
					}
				}
			};

			const syncEffectState = () => {
				engine.activeEffects =
					Boolean(engine.hoveredNodeId) && !engine.isInteracting;
			};

			const scheduleSettledQuality = () => {
				if (engine.settleTimer !== null) {
					window.clearTimeout(engine.settleTimer);
				}

				engine.settleTimer = window.setTimeout(() => {
					engine.settleTimer = null;
					engine.isInteracting = false;
					engine.avatarQualityTier = "settled";
					syncEffectState();
					markDirty(true, true);
				}, QUALITY_SETTLE_DELAY_MS);
			};

			const startInteraction = () => {
				if (engine.settleTimer !== null) {
					window.clearTimeout(engine.settleTimer);
					engine.settleTimer = null;
				}

				engine.isInteracting = true;
				engine.avatarQualityTier = "interactive";
				syncEffectState();
				markDirty(true, true);
			};

			const updateHoverState = (mouseX: number, mouseY: number) => {
				const { x: tx, y: ty, k } = engine.transform;
				const worldX = (mouseX - tx) / k;
				const worldY = (mouseY - ty) / k;
				const hitNodeId =
					findNodeAtPosition(engine.layout.nodes, worldX, worldY)?.id ?? null;

				if (engine.hoveredNodeId === hitNodeId) {
					baseCanvas.style.cursor = hitNodeId ? "pointer" : "default";
					return;
				}

				engine.hoveredNodeId = hitNodeId;
				recomputeConnectedNodeIds();
				syncEffectState();
				baseCanvas.style.cursor = hitNodeId ? "pointer" : "default";
				markDirty(true, true);
			};

			const updateTheme = () => {
				const styles = getComputedStyle(document.documentElement);
				engine.theme = {
					bg: styles.getPropertyValue("--background").trim(),
					fg: styles.getPropertyValue("--foreground").trim(),
					card: styles.getPropertyValue("--card").trim(),
				};
				markDirty(true, false);
			};

			const getEventPos = (event: MouseEvent | PointerEvent | WheelEvent) => {
				const rect = baseCanvas.getBoundingClientRect();

				return { x: event.clientX - rect.left, y: event.clientY - rect.top };
			};

			const onWheel = (event: WheelEvent) => {
				event.preventDefault();
				startInteraction();

				const pos = getEventPos(event);
				const { x, y, k } = engine.transform;
				const scaleAdjustment = Math.exp(-event.deltaY * 0.002);
				const nextScale = Math.min(Math.max(k * scaleAdjustment, 0.03), 4);

				engine.transform.x = pos.x - (pos.x - x) * (nextScale / k);
				engine.transform.y = pos.y - (pos.y - y) * (nextScale / k);
				engine.transform.k = nextScale;

				markDirty(true, true);
				scheduleSettledQuality();
			};

			const onPointerDown = (event: PointerEvent) => {
				engine.isDragging = true;
				startInteraction();
				engine.lastPointerPos = { x: event.clientX, y: event.clientY };
				engine.pointerDownPos = getEventPos(event);

				baseCanvas.setPointerCapture(event.pointerId);
				baseCanvas.style.cursor = "grabbing";
			};

			const onPointerMove = (event: PointerEvent) => {
				if (engine.isDragging) {
					const dx = event.clientX - engine.lastPointerPos.x;
					const dy = event.clientY - engine.lastPointerPos.y;

					engine.transform.x += dx;
					engine.transform.y += dy;
					engine.lastPointerPos = { x: event.clientX, y: event.clientY };
					markDirty(true, false);
					return;
				}

				const pos = getEventPos(event);
				updateHoverState(pos.x, pos.y);
			};

			const endPointerInteraction = (event: PointerEvent) => {
				engine.isDragging = false;
				baseCanvas.releasePointerCapture(event.pointerId);

				const pos = getEventPos(event);
				const dx = pos.x - engine.pointerDownPos.x;
				const dy = pos.y - engine.pointerDownPos.y;

				updateHoverState(pos.x, pos.y);

				if (dx * dx + dy * dy < 25 && engine.hoveredNodeId) {
					setSelectedCharId(engine.hoveredNodeId);
				}

				scheduleSettledQuality();
			};

			const onPointerLeave = () => {
				if (engine.isDragging) {
					return;
				}

				if (engine.hoveredNodeId !== null) {
					engine.hoveredNodeId = null;
					engine.connectedNodeIds.clear();
					syncEffectState();
					baseCanvas.style.cursor = "default";
					markDirty(true, true);
				}
			};

			const resizeObserver = new ResizeObserver((entries) => {
				const rect = entries[0].contentRect;
				const dpr = window.devicePixelRatio || 1;

				engine.width = rect.width;
				engine.height = rect.height;

				for (const canvas of [baseCanvas, fxCanvas]) {
					canvas.width = rect.width * dpr;
					canvas.height = rect.height * dpr;
					canvas.style.width = `${rect.width}px`;
					canvas.style.height = `${rect.height}px`;
				}

				if (!engine.hasCentered) {
					engine.transform.x = rect.width / 2;
					engine.transform.y = rect.height / 2;
					engine.hasCentered = true;
				}

				prewarmVisibleAvatarSprites(engine, scheduleRender);
				markDirty(true, true);
			});

			resizeObserver.observe(element);
			updateTheme();

			const themeObserver = new MutationObserver(updateTheme);
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class"],
			});

			baseCanvas.addEventListener("wheel", onWheel, { passive: false });
			baseCanvas.addEventListener("pointerdown", onPointerDown);
			baseCanvas.addEventListener("pointermove", onPointerMove);
			baseCanvas.addEventListener("pointerup", endPointerInteraction);
			baseCanvas.addEventListener("pointercancel", endPointerInteraction);
			baseCanvas.addEventListener("pointerleave", onPointerLeave);

			markDirty(true, true);

			return () => {
				if (engine.settleTimer !== null) {
					window.clearTimeout(engine.settleTimer);
					engine.settleTimer = null;
				}

				if (engine.animFrameId) {
					window.cancelAnimationFrame(engine.animFrameId);
					engine.animFrameId = 0;
				}

				resizeObserver.disconnect();
				themeObserver.disconnect();
				baseCanvas.removeEventListener("wheel", onWheel);
				baseCanvas.removeEventListener("pointerdown", onPointerDown);
				baseCanvas.removeEventListener("pointermove", onPointerMove);
				baseCanvas.removeEventListener("pointerup", endPointerInteraction);
				baseCanvas.removeEventListener("pointercancel", endPointerInteraction);
				baseCanvas.removeEventListener("pointerleave", onPointerLeave);

				engine.baseCanvas = null;
				engine.baseCtx = null;
				engine.fxCanvas = null;
				engine.fxCtx = null;
				scheduleRenderRef.current = null;
			};
		},
		[setSelectedCharId],
	);

	return (
		<div
			className="relative flex h-full w-full flex-1 items-center justify-end overflow-hidden"
			ref={containerRef}
		>
			<canvas
				className="absolute inset-0 block pointer-events-auto"
				data-layer="base"
			/>
			<canvas
				className="pointer-events-none absolute inset-0 block"
				data-layer="fx"
			/>

			{networkMode === "group" && (
				<div className="pointer-events-none absolute top-6 left-6 z-10 flex flex-col gap-2">
					{groups.map((group) => (
						<div
							key={group.id}
							className="flex cursor-pointer items-center gap-2 rounded-full border border-foreground/5 bg-card/40 px-3 py-1.5 backdrop-blur-md transition-all hover:bg-foreground/10 pointer-events-auto"
							onMouseEnter={() => {
								const engine = engineRef.current;

								if (engine.hoveredGroupId === group.id) {
									return;
								}

								engine.hoveredGroupId = group.id;
								engine.baseDirty = true;
								engine.fxDirty = true;
								scheduleRenderRef.current?.();
							}}
							onMouseLeave={() => {
								const engine = engineRef.current;

								if (engine.hoveredGroupId === null) {
									return;
								}

								engine.hoveredGroupId = null;
								engine.baseDirty = true;
								engine.fxDirty = true;
								scheduleRenderRef.current?.();
							}}
						>
							<div
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: group.color }}
							/>
							<span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
								{group.name}
							</span>
						</div>
					))}
				</div>
			)}

			<div className="pointer-events-none z-10 flex w-min flex-col flex-wrap-reverse gap-3 p-6">
				{types.map((type) => (
					<Badge
						variant="secondary"
						key={type.id}
						style={{ "--badge-color": type.color } as React.CSSProperties}
						className="self-start border border-foreground/5 bg-card/40 p-2.5 pr-1 backdrop-blur-md transition-all hover:bg-foreground/10 pointer-events-auto"
					>
						<span className="text-[10px] font-bold uppercase tracking-widest">
							{type.label}
						</span>
						<div
							className="ml-2 h-3 w-3 rounded-full"
							style={{ backgroundColor: type.color }}
						/>
					</Badge>
				))}
			</div>
		</div>
	);
}
