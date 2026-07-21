import type { Application } from "pixi.js";
import { useEffect, useMemo, useRef } from "react";
import {
	buildNetworkLayout,
	findNodeAtPosition,
	type LayoutData,
} from "@/lib/network-graph";
import {
	colorToNumber,
	createLayers,
	destroyLayers,
	drawFxLayer,
	drawStaticScene,
	type EngineState,
	syncWorldTransform,
} from "@/lib/network-graph-renderer";
import { sharedPixiRuntime } from "@/lib/pixi-runtime";
import { useGraphStore } from "@/store/useGraphStore";
import NetworkGraphOverlay from "./NetworkGraphOverlay";

const QUALITY_SETTLE_DELAY_MS = 90;

export default function NetworkGraph() {
	const allChars = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const types = useGraphStore((state) => state.relationshipTypes);
	const groups = useGraphStore((state) => state.groups);
	const networkMode = useGraphStore((state) => state.networkMode);
	const networkCurveStyle = useGraphStore((state) => state.networkCurveStyle);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const scheduleRenderRef = useRef<(() => void) | null>(null);
	const engineRef = useRef<EngineState>({
		app: null,
		layers: null,
		canvas: null,
		transform: { x: 0, y: 0, k: 0.5 },
		width: 0,
		height: 0,
		theme: { bg: 0x000000, fg: 0xffffff, card: 0x222222 },
		hoveredNodeId: null,
		hoveredGroupId: null,
		connectedNodeIds: new Set<string>(),
		isDragging: false,
		isInteracting: false,
		hasCentered: false,
		pointerDownPos: { x: 0, y: 0 },
		lastPointerPos: { x: 0, y: 0 },
		layout: {
			nodes: [],
			links: [],
			groups: [],
			nodeMap: new Map(),
		},
		staticDirty: true,
		fxDirty: true,
		activeEffects: false,
		animFrameId: 0,
		settleTimer: null,
	});

	const layout = useMemo<LayoutData>(() => {
		return buildNetworkLayout(
			allChars,
			relationships,
			types,
			groups,
			networkMode,
			networkCurveStyle,
		);
	}, [allChars, groups, networkCurveStyle, networkMode, relationships, types]);

	useEffect(() => {
		const engine = engineRef.current;

		engine.layout = layout;
		engine.staticDirty = true;
		engine.fxDirty = true;
		scheduleRenderRef.current?.();
	}, [layout]);

	useEffect(() => {
		const element = containerRef.current;

		if (!element) {
			return;
		}

		const engine = engineRef.current;
		const layers = createLayers();
		let disposed = false;
		let attached = false;
		let attachToken = 0;
		let canvas: HTMLCanvasElement;
		let app: Application | null = null;
		let resizeObserver: ResizeObserver | null = null;
		let themeObserver: MutationObserver | null = null;

		const markDirty = (staticLayer = true, fxLayer = true) => {
			if (staticLayer) {
				engine.staticDirty = true;
			}

			if (fxLayer) {
				engine.fxDirty = true;
			}

			scheduleRenderRef.current?.();
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
			const nextActiveEffects =
				Boolean(engine.hoveredNodeId) && !engine.isInteracting;

			if (engine.activeEffects !== nextActiveEffects) {
				engine.activeEffects = nextActiveEffects;
				engine.fxDirty = true;
			}
		};

		const scheduleRender = () => {
			if (engine.animFrameId) {
				return;
			}

			engine.animFrameId = window.requestAnimationFrame(() => {
				engine.animFrameId = 0;

				if (engine.staticDirty) {
					drawStaticScene(engine, scheduleRender);
					engine.staticDirty = false;
				} else {
					syncWorldTransform(engine);
				}

				if (engine.fxDirty || engine.activeEffects) {
					drawFxLayer(engine);
					engine.fxDirty = false;
				}

				engine.app?.render();

				if (engine.activeEffects) {
					scheduleRender();
				}
			});
		};

		const scheduleSettledQuality = () => {
			if (engine.settleTimer !== null) {
				window.clearTimeout(engine.settleTimer);
			}

			engine.settleTimer = window.setTimeout(() => {
				engine.settleTimer = null;
				engine.isInteracting = false;
				syncEffectState();
				markDirty(true, true);
			}, QUALITY_SETTLE_DELAY_MS);
		};

		const startInteraction = () => {
			if (engine.settleTimer !== null) {
				window.clearTimeout(engine.settleTimer);
				engine.settleTimer = null;
			}

			const wasInteracting = engine.isInteracting;
			engine.isInteracting = true;
			syncEffectState();

			if (!wasInteracting) {
				markDirty(true, true);
			}
		};

		const updateHoverState = (mouseX: number, mouseY: number) => {
			const { x: tx, y: ty, k } = engine.transform;
			const worldX = (mouseX - tx) / k;
			const worldY = (mouseY - ty) / k;
			const hitNodeId =
				findNodeAtPosition(engine.layout.nodes, worldX, worldY)?.id ?? null;

			if (engine.hoveredNodeId === hitNodeId) {
				canvas.style.cursor = hitNodeId ? "pointer" : "default";
				return;
			}

			engine.hoveredNodeId = hitNodeId;
			recomputeConnectedNodeIds();
			syncEffectState();
			canvas.style.cursor = hitNodeId ? "pointer" : "default";
			markDirty(true, true);
		};

		const updateTheme = () => {
			const styles = getComputedStyle(document.documentElement);

			engine.theme = {
				bg: colorToNumber(
					styles.getPropertyValue("--background"),
					engine.theme.bg,
				),
				fg: colorToNumber(styles.getPropertyValue("--foreground"), 0xffffff),
				card: colorToNumber(styles.getPropertyValue("--card"), 0x222222),
			};
			markDirty(true, false);
		};

		const getEventPos = (event: MouseEvent | PointerEvent | WheelEvent) => {
			const rect = canvas.getBoundingClientRect();

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

			markDirty(false, false);
			scheduleSettledQuality();
		};

		const onPointerDown = (event: PointerEvent) => {
			engine.isDragging = true;
			startInteraction();
			engine.lastPointerPos = { x: event.clientX, y: event.clientY };
			engine.pointerDownPos = getEventPos(event);

			canvas.setPointerCapture(event.pointerId);
			canvas.style.cursor = "grabbing";
		};

		const onPointerMove = (event: PointerEvent) => {
			if (engine.isDragging) {
				const dx = event.clientX - engine.lastPointerPos.x;
				const dy = event.clientY - engine.lastPointerPos.y;

				engine.transform.x += dx;
				engine.transform.y += dy;
				engine.lastPointerPos = { x: event.clientX, y: event.clientY };
				markDirty(false, false);
				return;
			}

			const pos = getEventPos(event);
			updateHoverState(pos.x, pos.y);
		};

		const endPointerInteraction = (event: PointerEvent) => {
			engine.isDragging = false;

			try {
				canvas.releasePointerCapture(event.pointerId);
			} catch {
				// Some browsers release capture automatically on cancellation.
			}

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
				canvas.style.cursor = "default";
				markDirty(true, true);
			}
		};

		scheduleRenderRef.current = scheduleRender;
		engine.layers = layers;

		sharedPixiRuntime
			.attach(element)
			.then((attachment) => {
				if (disposed) {
					sharedPixiRuntime.detach(element, attachment.token);
					return;
				}

				app = attachment.app;
				canvas = attachment.canvas;
				attached = true;
				attachToken = attachment.token;
				engine.app = app;
				engine.canvas = canvas;
				sharedPixiRuntime.activateRoot("network", layers.world);
				canvas.setAttribute("aria-label", "Network graph");

				resizeObserver = new ResizeObserver((entries) => {
					const rect = entries[0].contentRect;
					const width = Math.max(rect.width, 1);
					const height = Math.max(rect.height, 1);
					const resolution = window.devicePixelRatio || 1;

					engine.width = width;
					engine.height = height;
					sharedPixiRuntime.resize(width, height, resolution);

					if (!engine.hasCentered) {
						engine.transform.x = width / 2;
						engine.transform.y = height / 2;
						engine.hasCentered = true;
					}

					markDirty(true, true);
				});
				resizeObserver.observe(element);

				themeObserver = new MutationObserver(updateTheme);
				themeObserver.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["class"],
				});

				updateTheme();
				canvas.addEventListener("wheel", onWheel, { passive: false });
				canvas.addEventListener("pointerdown", onPointerDown);
				canvas.addEventListener("pointermove", onPointerMove);
				canvas.addEventListener("pointerup", endPointerInteraction);
				canvas.addEventListener("pointercancel", endPointerInteraction);
				canvas.addEventListener("pointerleave", onPointerLeave);
				markDirty(true, true);
			})
			.catch((error) => {
				console.error("Failed to attach network graph Pixi surface", error);
				engine.app = null;
				engine.layers = null;
			});

		return () => {
			disposed = true;

			if (engine.settleTimer !== null) {
				window.clearTimeout(engine.settleTimer);
				engine.settleTimer = null;
			}

			if (engine.animFrameId) {
				window.cancelAnimationFrame(engine.animFrameId);
				engine.animFrameId = 0;
			}

			resizeObserver?.disconnect();
			themeObserver?.disconnect();
			if (attached) {
				canvas.removeEventListener("wheel", onWheel);
				canvas.removeEventListener("pointerdown", onPointerDown);
				canvas.removeEventListener("pointermove", onPointerMove);
				canvas.removeEventListener("pointerup", endPointerInteraction);
				canvas.removeEventListener("pointercancel", endPointerInteraction);
				canvas.removeEventListener("pointerleave", onPointerLeave);
				canvas.style.cursor = "default";
				sharedPixiRuntime.deactivateRoot("network");
				sharedPixiRuntime.detach(element, attachToken);
			}

			if (engine.app === app) {
				engine.app = null;
			}

			if (engine.layers === layers) {
				engine.layers = null;
			}

			engine.canvas = null;
			scheduleRenderRef.current = null;
			destroyLayers(layers);
		};
	}, [setSelectedCharId]);

	return (
		<div
			className="relative flex h-full w-full flex-1 items-center justify-end overflow-hidden"
			ref={containerRef}
		>
			<NetworkGraphOverlay
				groups={groups}
				types={types}
				showGroups={networkMode === "group"}
			/>
		</div>
	);
}
