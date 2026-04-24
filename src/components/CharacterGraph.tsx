import { Plus } from "lucide-react";
import {
	type Application,
	Container,
	type ContainerChild,
	Graphics,
	Sprite,
	Text,
	Texture,
} from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { acquireSharedPixiApp } from "@/lib/shared-pixi";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, Relationship, RelationshipType } from "@/types/types";
import ConfirmModal from "./ConfirmModal";
import RelationshipModal from "./RelationshipModal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const RELATED_RADIUS = 40;
const NODE_LABEL_OFFSET = 16;
const QUALITY_SETTLE_DELAY_MS = 80;
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const LINK_HIT_WIDTH = 16;
const LINK_SEGMENTS = 180;
const LINK_SEGMENT_OVERLAP = 0.004;
const LINK_END_TRIM = 12;
const ARROW_LENGTH = 16;
const ARROW_WIDTH = 10;
const ARROW_POSITION_SPREAD = 0.035;
const savedCharacterViewState = {
	transform: { x: 0, y: 0, k: 1 },
	hasCentered: false,
};

type Point = { x: number; y: number };

type AvatarTextureEntry = {
	texture: Texture | null;
	loading: boolean;
	failed: boolean;
	callbacks: Set<() => void>;
};

type CharacterNodeLayout = {
	character: Character;
	x: number;
	y: number;
	labelX: number;
	labelY: number;
	labelAnchorX: number;
	labelAnchorY: number;
};

type RelationshipLayout = {
	key: string;
	rel: Relationship;
	type: RelationshipType | undefined;
	isFromCenter: boolean;
	arrowT: number;
	start: Point;
	control: Point;
	end: Point;
	anchor: Point;
	opacity: number;
};

type CharacterGraphLayout = {
	selectedCharacter: Character | undefined;
	relatedNodes: CharacterNodeLayout[];
	links: RelationshipLayout[];
	centerRadius: number;
	radius: number;
};

type CharacterPixiLayers = {
	world: Container;
	links: Container;
	nodes: Container;
	labels: Container;
};

type CharacterEngineState = {
	app: Application | null;
	canvas: HTMLCanvasElement | null;
	layers: CharacterPixiLayers | null;
	layout: CharacterGraphLayout;
	width: number;
	height: number;
	transform: { x: number; y: number; k: number };
	hasCentered: boolean;
	isDragging: boolean;
	pointerDownPos: Point;
	lastPointerPos: Point;
	hoveredLinkKey: string | null;
	animFrameId: number;
	settleTimer: number | null;
};

type HoveredRelationship = {
	link: RelationshipLayout;
	x: number;
	y: number;
	side: "top" | "bottom";
};

const avatarTextureCache = new Map<string, AvatarTextureEntry>();

function parseHexColor(value: string | null | undefined, fallback: number) {
	if (!value) {
		return fallback;
	}

	const hex = value.replace("#", "").trim();

	if (hex.length === 3) {
		return Number.parseInt(
			hex
				.split("")
				.map((part) => part + part)
				.join(""),
			16,
		);
	}

	if (hex.length === 6) {
		return Number.parseInt(hex, 16);
	}

	return fallback;
}

function clearLayer(layer: Container) {
	const children = layer.removeChildren();

	for (const child of children) {
		child.destroy({ children: true });
	}
}

function createLayers(): CharacterPixiLayers {
	const world = new Container();
	const links = new Container();
	const nodes = new Container();
	const labels = new Container();

	world.addChild(links, nodes, labels);

	return { world, links, nodes, labels };
}

function destroyLayers(layers: CharacterPixiLayers) {
	const children: ContainerChild[] = [
		layers.links,
		layers.nodes,
		layers.labels,
	];

	for (const child of children) {
		child.destroy({ children: true });
	}

	layers.world.destroy({ children: true });
}

function notifyAvatarTextureReady(entry: AvatarTextureEntry) {
	const callbacks = Array.from(entry.callbacks);

	entry.callbacks.clear();

	for (const callback of callbacks) {
		callback();
	}
}

function getAvatarTexture(avatarUrl: string, onReady: () => void) {
	const cached = avatarTextureCache.get(avatarUrl);

	if (cached) {
		if (cached.loading) {
			cached.callbacks.add(onReady);
		}

		return { failed: cached.failed, texture: cached.texture };
	}

	const entry: AvatarTextureEntry = {
		texture: null,
		loading: true,
		failed: false,
		callbacks: new Set([onReady]),
	};
	const image = new Image();
	const finish = () => {
		if (entry.texture || entry.failed) {
			return;
		}

		if (!image.naturalWidth || !image.naturalHeight) {
			entry.loading = false;
			entry.failed = true;
			queueMicrotask(() => notifyAvatarTextureReady(entry));
			return;
		}

		try {
			entry.texture = Texture.from(image, true);
			entry.loading = false;
		} catch {
			entry.loading = false;
			entry.failed = true;
		}

		queueMicrotask(() => notifyAvatarTextureReady(entry));
	};
	const fail = () => {
		entry.loading = false;
		entry.failed = true;
		queueMicrotask(() => notifyAvatarTextureReady(entry));
	};

	avatarTextureCache.set(avatarUrl, entry);
	image.decoding = "async";

	if (!avatarUrl.startsWith("data:") && !avatarUrl.startsWith("blob:")) {
		image.crossOrigin = "anonymous";
	}

	image.onload = finish;
	image.onerror = fail;
	image.src = avatarUrl;

	return { failed: false, texture: null };
}

function addText(
	layer: Container,
	text: string,
	x: number,
	y: number,
	anchorX: number,
	anchorY: number,
	fontSize: number,
	alpha = 1,
) {
	const label = new Text({
		text,
		anchor: { x: anchorX, y: anchorY },
		style: {
			fill: 0xffffff,
			fontFamily: "sans-serif",
			fontSize,
			fontWeight: "700",
		},
	});

	label.x = x;
	label.y = y;
	label.alpha = alpha;
	layer.addChild(label);
}

function addAvatar(
	layer: Container,
	character: Character | undefined,
	x: number,
	y: number,
	radius: number,
	onReady: () => void,
) {
	const id = character?.id ?? "center";
	const name = character?.name ?? "";
	const avatarUrl =
		character?.avatar || `https://picsum.photos/seed/${id}/160/160`;
	const textureEntry = getAvatarTexture(avatarUrl, onReady);

	layer.addChild(
		new Graphics()
			.circle(x, y, radius + 2)
			.fill({ color: 0x0a0a0a })
			.stroke({ color: 0xffffff, alpha: 0.3, width: 1 }),
	);

	if (textureEntry.texture) {
		const mask = new Graphics().circle(x, y, radius).fill({ color: 0xffffff });
		const sprite = new Sprite(textureEntry.texture);
		const textureWidth = sprite.texture.width || radius * 2;
		const textureHeight = sprite.texture.height || radius * 2;
		const scale = Math.max(
			(radius * 2) / textureWidth,
			(radius * 2) / textureHeight,
		);

		sprite.anchor.set(0.5);
		sprite.x = x;
		sprite.y = y;
		sprite.scale.set(scale);
		sprite.mask = mask;
		layer.addChild(mask, sprite);
		return;
	}

	layer.addChild(new Graphics().circle(x, y, radius).fill({ color: 0x111111 }));
	addText(
		layer,
		name.substring(0, 2).toUpperCase(),
		x,
		y,
		0.5,
		0.5,
		Math.max(14, radius * 0.42),
		textureEntry.failed ? 1 : 0.55,
	);
}

function sampleQuadratic(link: RelationshipLayout, t: number): Point {
	const t1 = 1 - t;

	return {
		x:
			t1 * t1 * link.start.x + 2 * t1 * t * link.control.x + t * t * link.end.x,
		y:
			t1 * t1 * link.start.y + 2 * t1 * t * link.control.y + t * t * link.end.y,
	};
}

function sampleQuadraticTangent(link: RelationshipLayout, t: number): Point {
	return {
		x:
			2 * (1 - t) * (link.control.x - link.start.x) +
			2 * t * (link.end.x - link.control.x),
		y:
			2 * (1 - t) * (link.control.y - link.start.y) +
			2 * t * (link.end.y - link.control.y),
	};
}

function getTrimmedLinkRange(
	link: RelationshipLayout,
	startTrimDistance: number,
	endTrimDistance: number,
) {
	const steps = 48;
	let totalLength = 0;
	const segmentLengths: number[] = [];
	let previous = sampleQuadratic(link, 0);

	for (let index = 1; index <= steps; index += 1) {
		const current = sampleQuadratic(link, index / steps);
		const length = Math.hypot(current.x - previous.x, current.y - previous.y);

		segmentLengths.push(length);
		totalLength += length;
		previous = current;
	}

	if (totalLength <= startTrimDistance + endTrimDistance) {
		return { start: 0, end: 1 };
	}

	const tAtDistance = (targetDistance: number) => {
		let walked = 0;

		for (let index = 0; index < segmentLengths.length; index += 1) {
			const length = segmentLengths[index];

			if (walked + length >= targetDistance) {
				const localT = length === 0 ? 0 : (targetDistance - walked) / length;

				return (index + localT) / steps;
			}

			walked += length;
		}

		return 1;
	};

	return {
		start: tAtDistance(startTrimDistance),
		end: tAtDistance(totalLength - endTrimDistance),
	};
}

function drawDirectionalArrow(
	graphics: Graphics,
	link: RelationshipLayout,
	t: number,
	color: number,
	alpha: number,
) {
	const point = sampleQuadratic(link, t);
	const rawTangent = sampleQuadraticTangent(link, t);
	const tangent = link.isFromCenter
		? rawTangent
		: { x: -rawTangent.x, y: -rawTangent.y };
	const angle = Math.atan2(tangent.y, tangent.x);
	const halfLength = ARROW_LENGTH / 2;
	const tip = {
		x: point.x + Math.cos(angle) * halfLength,
		y: point.y + Math.sin(angle) * halfLength,
	};
	const tail = {
		x: point.x - Math.cos(angle) * halfLength,
		y: point.y - Math.sin(angle) * halfLength,
	};
	const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
	const left = {
		x: tail.x + normal.x * ARROW_WIDTH * 0.5,
		y: tail.y + normal.y * ARROW_WIDTH * 0.5,
	};
	const right = {
		x: tail.x - normal.x * ARROW_WIDTH * 0.5,
		y: tail.y - normal.y * ARROW_WIDTH * 0.5,
	};

	graphics
		.poly([tip.x, tip.y, left.x, left.y, point.x, point.y, right.x, right.y])
		.fill({ color: 0x050505, alpha: Math.min(alpha * 0.45, 0.35) })
		.stroke({ color: 0x050505, alpha: Math.min(alpha * 0.7, 0.45), width: 3 })
		.poly([tip.x, tip.y, left.x, left.y, point.x, point.y, right.x, right.y])
		.fill({ color, alpha: Math.min(alpha + 0.1, 1) });
}

function drawTrimmedQuadraticPath(
	graphics: Graphics,
	link: RelationshipLayout,
	range: { start: number; end: number },
	steps = 64,
) {
	const start = sampleQuadratic(link, range.start);

	graphics.beginPath().moveTo(start.x, start.y);

	for (let index = 1; index <= steps; index += 1) {
		const t = range.start + (index / steps) * (range.end - range.start);
		const point = sampleQuadratic(link, t);

		graphics.lineTo(point.x, point.y);
	}

	return graphics;
}

function drawRelationshipLink(
	layer: Container,
	link: RelationshipLayout,
	isHovered: boolean,
) {
	const color = parseHexColor(link.type?.color, 0x777777);
	const graphics = new Graphics();
	const opacity = isHovered ? 1 : link.opacity;
	const width = isHovered ? 5 : 4;
	const range = getTrimmedLinkRange(link, LINK_END_TRIM, LINK_END_TRIM);
	const rangeSize = range.end - range.start;

	drawTrimmedQuadraticPath(graphics, link, range).stroke({
		color,
		alpha: 0.1 * opacity,
		width,
		cap: "round",
		join: "round",
	});

	for (let index = 0; index < LINK_SEGMENTS; index += 1) {
		const localT0 = Math.max(0, index / LINK_SEGMENTS - LINK_SEGMENT_OVERLAP);
		const localT1 = Math.min(
			1,
			(index + 1) / LINK_SEGMENTS + LINK_SEGMENT_OVERLAP,
		);
		const t0 = range.start + localT0 * rangeSize;
		const t1 = range.start + localT1 * rangeSize;
		const p0 = sampleQuadratic(link, t0);
		const p1 = sampleQuadratic(link, t1);
		const midT = (localT0 + localT1) / 2;
		const fadeT = link.isFromCenter ? midT : 1 - midT;
		const alpha = (0.08 + fadeT * 0.92) * opacity;

		graphics
			.beginPath()
			.moveTo(p0.x, p0.y)
			.lineTo(p1.x, p1.y)
			.stroke({ color, alpha, width, cap: "butt", join: "round" });
	}

	drawDirectionalArrow(graphics, link, link.arrowT, color, opacity);

	layer.addChild(graphics);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) {
		const sx = point.x - start.x;
		const sy = point.y - start.y;

		return Math.sqrt(sx * sx + sy * sy);
	}

	const t = Math.max(
		0,
		Math.min(
			1,
			((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq,
		),
	);
	const projection = { x: start.x + dx * t, y: start.y + dy * t };
	const px = point.x - projection.x;
	const py = point.y - projection.y;

	return Math.sqrt(px * px + py * py);
}

function hitTestLink(link: RelationshipLayout, point: Point, scale: number) {
	const threshold = LINK_HIT_WIDTH / Math.max(scale, 0.2);

	for (let index = 0; index < 32; index += 1) {
		const p0 = sampleQuadratic(link, index / 32);
		const p1 = sampleQuadratic(link, (index + 1) / 32);

		if (distanceToSegment(point, p0, p1) <= threshold) {
			return true;
		}
	}

	return false;
}

function buildCharacterLayout(
	selectedId: string | null,
	selectedCharacter: Character | undefined,
	allChars: Character[],
	relationships: Relationship[],
	types: RelationshipType[],
): CharacterGraphLayout {
	if (!selectedId) {
		return {
			selectedCharacter,
			relatedNodes: [],
			links: [],
			centerRadius: 80,
			radius: 220,
		};
	}

	const typeMap = new Map(types.map((type) => [type.id, type]));
	const relatedIds = new Set<string>();

	for (const rel of relationships) {
		if (rel.fromId === selectedId) {
			relatedIds.add(rel.toId);
		}

		if (rel.toId === selectedId) {
			relatedIds.add(rel.fromId);
		}
	}

	const relatedCharacters = allChars
		.filter((character) => relatedIds.has(character.id))
		.sort((a, b) => a.name.localeCompare(b.name));
	const maxBundleSize = relatedCharacters.reduce((max, character) => {
		const relCount = relationships.filter(
			(rel) =>
				(rel.fromId === selectedId && rel.toId === character.id) ||
				(rel.fromId === character.id && rel.toId === selectedId),
		).length;

		return Math.max(max, relCount);
	}, 0);
	const centerRadius = Math.max(
		80,
		60 + relatedCharacters.length * 1.5,
		(maxBundleSize * 16) / 2 + 30,
	);
	const minRadiusForNoTouch =
		(relatedCharacters.length * (RELATED_RADIUS * 2 + 7)) / (2 * Math.PI);
	const radius = Math.max(
		220,
		Math.ceil(minRadiusForNoTouch),
		centerRadius + RELATED_RADIUS + 100,
	);
	const relatedNodes: CharacterNodeLayout[] = [];
	const links: RelationshipLayout[] = [];

	relatedCharacters.forEach((character, index) => {
		const angle =
			(index / relatedCharacters.length) * 2 * Math.PI - Math.PI / 2;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const x = radius * cos;
		const y = radius * sin;
		const textRadius = radius + RELATED_RADIUS + NODE_LABEL_OFFSET;

		relatedNodes.push({
			character,
			x,
			y,
			labelX: textRadius * cos,
			labelY: textRadius * sin,
			labelAnchorX: cos > 0.5 ? 0 : cos < -0.5 ? 1 : 0.5,
			labelAnchorY: sin > 0.5 ? 0 : sin < -0.5 ? 1 : 0.5,
		});

		const rels = relationships.filter(
			(rel) =>
				(rel.fromId === selectedId && rel.toId === character.id) ||
				(rel.fromId === character.id && rel.toId === selectedId),
		);

		rels.forEach((rel, relIndex) => {
			const type = typeMap.get(rel.typeId);
			const typeValue = rel.value ?? type?.value ?? 0;
			const absValue = Math.abs(typeValue);
			const edgeOpacity = 0.4 + absValue * 0.6;
			const bowOffset = (relIndex - (rels.length - 1) / 2) * 20;
			const effectiveOffset = bowOffset === 0 ? 0.01 : bowOffset;
			const radial = { x: cos, y: sin };
			const tangent = { x: -sin, y: cos };
			const startDistance = centerRadius + 8;
			const endDistance = radius - RELATED_RADIUS - 8;
			const controlDistance = (startDistance + endDistance) / 2;
			const controlOffset = effectiveOffset * 2.5;
			const start = {
				x: radial.x * startDistance,
				y: radial.y * startDistance,
			};
			const end = {
				x: radial.x * endDistance,
				y: radial.y * endDistance,
			};
			const control = {
				x: radial.x * controlDistance + tangent.x * controlOffset,
				y: radial.y * controlDistance + tangent.y * controlOffset,
			};
			const anchor = {
				x: radial.x * controlDistance + tangent.x * (controlOffset / 2),
				y: radial.y * controlDistance + tangent.y * (controlOffset / 2),
			};
			const arrowT = Math.min(
				0.78,
				Math.max(
					0.22,
					(rel.fromId === selectedId ? 0.68 : 0.32) +
						(relIndex - (rels.length - 1) / 2) * ARROW_POSITION_SPREAD,
				),
			);

			links.push({
				key: `${rel.fromId}-${rel.toId}-${rel.typeId}-${relIndex}`,
				rel,
				type,
				isFromCenter: rel.fromId === selectedId,
				arrowT,
				start,
				control,
				end,
				anchor,
				opacity: edgeOpacity,
			});
		});
	});

	return { selectedCharacter, relatedNodes, links, centerRadius, radius };
}

function renderCharacterScene(
	engine: CharacterEngineState,
	scheduleRender: () => void,
) {
	const layers = engine.layers;

	if (!layers) {
		return;
	}

	clearLayer(layers.links);
	clearLayer(layers.nodes);
	clearLayer(layers.labels);

	layers.world.position.set(engine.transform.x, engine.transform.y);
	layers.world.scale.set(engine.transform.k);

	for (const link of engine.layout.links) {
		drawRelationshipLink(
			layers.links,
			link,
			engine.hoveredLinkKey === link.key,
		);
	}

	for (const node of engine.layout.relatedNodes) {
		const isHovered = false;

		addAvatar(
			layers.nodes,
			node.character,
			node.x,
			node.y,
			RELATED_RADIUS,
			scheduleRender,
		);
		addText(
			layers.labels,
			node.character.name,
			node.labelX,
			node.labelY,
			node.labelAnchorX,
			node.labelAnchorY,
			10,
			isHovered ? 1 : 0.7,
		);
	}

	addAvatar(
		layers.nodes,
		engine.layout.selectedCharacter,
		0,
		0,
		engine.layout.centerRadius,
		scheduleRender,
	);

	engine.app?.render();
}

function screenToWorld(engine: CharacterEngineState, point: Point): Point {
	const { x, y, k } = engine.transform;

	return {
		x: (point.x - x) / k,
		y: (point.y - y) / k,
	};
}

function worldToScreen(engine: CharacterEngineState, point: Point): Point {
	const { x, y, k } = engine.transform;

	return {
		x: point.x * k + x,
		y: point.y * k + y,
	};
}

export default function CharacterGraph() {
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);
	const allChars = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const types = useGraphStore((state) => state.relationshipTypes);
	const addRelationship = useGraphStore((state) => state.addRelationship);
	const updateRelationship = useGraphStore((state) => state.updateRelationship);
	const deleteRelationship = useGraphStore((state) => state.deleteRelationship);
	const selectedCharacter = useGraphStore((state) =>
		state.characters.find((character) => character.id === state.selectedCharId),
	);
	const layout = useMemo(
		() =>
			buildCharacterLayout(
				selectedId,
				selectedCharacter,
				allChars,
				relationships,
				types,
			),
		[selectedId, selectedCharacter, allChars, relationships, types],
	);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingRel, setEditingRel] = useState<Relationship | null>(null);
	const [deletingRel, setDeletingRel] = useState<Relationship | null>(null);
	const [hoveredRel, setHoveredRel] = useState<HoveredRelationship | null>(
		null,
	);
	const [isDragging, setIsDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const scheduleRenderRef = useRef<(() => void) | null>(null);
	const isModalOpenRef = useRef(isModalOpen);
	const engineRef = useRef<CharacterEngineState>({
		app: null,
		canvas: null,
		layers: null,
		layout,
		width: 0,
		height: 0,
		transform: { ...savedCharacterViewState.transform },
		hasCentered: savedCharacterViewState.hasCentered,
		isDragging: false,
		pointerDownPos: { x: 0, y: 0 },
		lastPointerPos: { x: 0, y: 0 },
		hoveredLinkKey: null,
		animFrameId: 0,
		settleTimer: null,
	});

	useEffect(() => {
		isModalOpenRef.current = isModalOpen;
	}, [isModalOpen]);

	useEffect(() => {
		const engine = engineRef.current;

		engine.layout = layout;
		engine.hoveredLinkKey = null;
		setHoveredRel(null);
		scheduleRenderRef.current?.();
	}, [layout]);

	useEffect(() => {
		const host = containerRef.current;

		if (!host) {
			return;
		}

		const engine = engineRef.current;
		const layers = createLayers();
		let disposed = false;
		let layersDestroyed = false;
		let app: Application | null = null;
		let canvas: HTMLCanvasElement | null = null;
		let releaseSharedApp: (() => void) | null = null;
		let resizeObserver: ResizeObserver | null = null;

		const safeDestroyLayers = () => {
			if (layersDestroyed) {
				return;
			}

			layersDestroyed = true;
			destroyLayers(layers);
		};

		const scheduleRender = () => {
			if (engine.animFrameId) {
				return;
			}

			engine.animFrameId = window.requestAnimationFrame(() => {
				engine.animFrameId = 0;
				renderCharacterScene(engine, scheduleRender);
			});
		};

		const getEventPos = (event: MouseEvent | PointerEvent | WheelEvent) => {
			if (!canvas) {
				return { x: 0, y: 0 };
			}

			const rect = canvas.getBoundingClientRect();

			return { x: event.clientX - rect.left, y: event.clientY - rect.top };
		};

		const findNodeAtWorldPoint = (point: Point) => {
			return (
				engine.layout.relatedNodes.find((node) => {
					const dx = node.x - point.x;
					const dy = node.y - point.y;

					return dx * dx + dy * dy <= RELATED_RADIUS * RELATED_RADIUS;
				}) ?? null
			);
		};

		const findLinkAtWorldPoint = (point: Point) => {
			return (
				engine.layout.links.find((link) =>
					hitTestLink(link, point, engine.transform.k),
				) ?? null
			);
		};

		const updateHover = (screenPoint: Point) => {
			if (!canvas || engine.isDragging || isModalOpenRef.current) {
				return;
			}

			const worldPoint = screenToWorld(engine, screenPoint);
			const node = findNodeAtWorldPoint(worldPoint);
			const link = node ? null : findLinkAtWorldPoint(worldPoint);
			const nextHoveredLinkKey = link?.key ?? null;

			canvas.style.cursor = node ? "pointer" : link ? "help" : "grab";

			if (engine.hoveredLinkKey !== nextHoveredLinkKey) {
				engine.hoveredLinkKey = nextHoveredLinkKey;
				scheduleRender();
			}

			if (!link) {
				setHoveredRel(null);
				return;
			}

			const anchor = worldToScreen(engine, link.anchor);
			const rect = canvas.getBoundingClientRect();
			const viewportAnchor = {
				x: rect.left + anchor.x,
				y: rect.top + anchor.y,
			};
			const side =
				rect.top + screenPoint.y < viewportAnchor.y ? "bottom" : "top";

			setHoveredRel({
				link,
				x: viewportAnchor.x,
				y: viewportAnchor.y,
				side,
			});
		};

		const scheduleSettledQuality = () => {
			if (engine.settleTimer !== null) {
				window.clearTimeout(engine.settleTimer);
			}

			engine.settleTimer = window.setTimeout(() => {
				engine.settleTimer = null;
				scheduleRender();
			}, QUALITY_SETTLE_DELAY_MS);
		};

		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const pos = getEventPos(event);
			const { x, y, k } = engine.transform;
			const scaleAdjustment = Math.exp(-event.deltaY * 0.002);
			const nextScale = Math.min(
				Math.max(k * scaleAdjustment, MIN_SCALE),
				MAX_SCALE,
			);

			engine.transform.x = pos.x - (pos.x - x) * (nextScale / k);
			engine.transform.y = pos.y - (pos.y - y) * (nextScale / k);
			engine.transform.k = nextScale;
			engine.hoveredLinkKey = null;
			setHoveredRel(null);
			scheduleRender();
			scheduleSettledQuality();
		};

		const onPointerDown = (event: PointerEvent) => {
			if (!canvas || isModalOpenRef.current) {
				return;
			}

			engine.isDragging = true;
			setIsDragging(true);
			engine.lastPointerPos = { x: event.clientX, y: event.clientY };
			engine.pointerDownPos = getEventPos(event);
			engine.hoveredLinkKey = null;
			setHoveredRel(null);
			canvas.setPointerCapture(event.pointerId);
			canvas.style.cursor = "grabbing";
			scheduleRender();
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!canvas) {
				return;
			}

			if (engine.isDragging) {
				const dx = event.clientX - engine.lastPointerPos.x;
				const dy = event.clientY - engine.lastPointerPos.y;

				engine.transform.x += dx;
				engine.transform.y += dy;
				engine.lastPointerPos = { x: event.clientX, y: event.clientY };
				scheduleRender();
				return;
			}

			updateHover(getEventPos(event));
		};

		const endPointerInteraction = (event: PointerEvent) => {
			if (!canvas) {
				return;
			}

			const wasDragging = engine.isDragging;

			engine.isDragging = false;
			setIsDragging(false);

			try {
				canvas.releasePointerCapture(event.pointerId);
			} catch {
				// Pointer capture can already be released by the browser.
			}

			if (!wasDragging || event.button === 2) {
				return;
			}

			const pos = getEventPos(event);
			const dx = pos.x - engine.pointerDownPos.x;
			const dy = pos.y - engine.pointerDownPos.y;

			if (dx * dx + dy * dy >= 25) {
				canvas.style.cursor = "grab";
				scheduleSettledQuality();
				return;
			}

			const worldPoint = screenToWorld(engine, pos);
			const node = findNodeAtWorldPoint(worldPoint);

			if (node) {
				setSelectedCharId(node.character.id);
				return;
			}

			const link = findLinkAtWorldPoint(worldPoint);

			if (link) {
				setEditingRel(link.rel);
				setIsModalOpen(true);
			}
		};

		const onPointerLeave = () => {
			if (engine.isDragging) {
				return;
			}

			if (canvas) {
				canvas.style.cursor = "grab";
			}

			engine.hoveredLinkKey = null;
			setHoveredRel(null);
			scheduleRender();
		};

		const onContextMenu = (event: MouseEvent) => {
			event.preventDefault();

			if (isModalOpenRef.current) {
				return;
			}

			const pos = getEventPos(event);
			const link = findLinkAtWorldPoint(screenToWorld(engine, pos));

			if (link) {
				setDeletingRel(link.rel);
			}
		};

		const syncSize = (observedRect?: { width: number; height: number }) => {
			const rect = host.getBoundingClientRect();
			const width = Math.max(rect.width || host.clientWidth, 1);
			const height = Math.max(rect.height || host.clientHeight, 1);
			const nextWidth = Math.max(observedRect?.width || width, 1);
			const nextHeight = Math.max(observedRect?.height || height, 1);
			const resolution = window.devicePixelRatio || 1;
			const wasPlaceholderSize = engine.width <= 1 || engine.height <= 1;

			engine.width = nextWidth;
			engine.height = nextHeight;
			app?.renderer.resize(nextWidth, nextHeight, resolution);

			if (canvas) {
				canvas.style.width = `${nextWidth}px`;
				canvas.style.height = `${nextHeight}px`;
			}

			if (
				!engine.hasCentered ||
				(wasPlaceholderSize && nextWidth > 1 && nextHeight > 1)
			) {
				engine.transform.x = nextWidth / 2;
				engine.transform.y = nextHeight / 2;
				engine.hasCentered = true;
			}

			scheduleRender();
		};

		scheduleRenderRef.current = scheduleRender;

		acquireSharedPixiApp("character-graph", host)
			.then((shared) => {
				if (disposed) {
					shared.release();
					safeDestroyLayers();
					return;
				}

				app = shared.app;
				canvas = shared.canvas;
				releaseSharedApp = shared.release;
				engine.app = app;
				engine.canvas = canvas;
				engine.layers = layers;
				app.stage.addChild(layers.world);

				resizeObserver = new ResizeObserver((entries) => {
					syncSize(entries[0]?.contentRect);
				});
				resizeObserver.observe(host);

				canvas.setAttribute("aria-label", "Character relationship graph");
				canvas.style.cursor = "grab";
				canvas.addEventListener("wheel", onWheel, { passive: false });
				canvas.addEventListener("pointerdown", onPointerDown);
				canvas.addEventListener("pointermove", onPointerMove);
				canvas.addEventListener("pointerup", endPointerInteraction);
				canvas.addEventListener("pointercancel", endPointerInteraction);
				canvas.addEventListener("pointerleave", onPointerLeave);
				canvas.addEventListener("contextmenu", onContextMenu);
				syncSize();
				window.requestAnimationFrame(() => syncSize());
				scheduleRender();
			})
			.catch(() => {
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
			canvas?.removeEventListener("wheel", onWheel);
			canvas?.removeEventListener("pointerdown", onPointerDown);
			canvas?.removeEventListener("pointermove", onPointerMove);
			canvas?.removeEventListener("pointerup", endPointerInteraction);
			canvas?.removeEventListener("pointercancel", endPointerInteraction);
			canvas?.removeEventListener("pointerleave", onPointerLeave);
			canvas?.removeEventListener("contextmenu", onContextMenu);

			if (canvas) {
				canvas.style.cursor = "default";
			}

			if (engine.app === app) {
				engine.app = null;
			}

			if (engine.layers === layers) {
				engine.layers = null;
			}

			savedCharacterViewState.transform = { ...engine.transform };
			savedCharacterViewState.hasCentered = engine.hasCentered;
			engine.canvas = null;
			scheduleRenderRef.current = null;
			releaseSharedApp?.();
			safeDestroyLayers();
		};
	}, [setSelectedCharId]);

	const tooltipValue = hoveredRel
		? (hoveredRel.link.rel.value ?? hoveredRel.link.type?.value ?? 0)
		: 0;

	return (
		<div className="grid grid-cols-1 grid-rows-1 w-full h-full overflow-hidden relative bg-transparent">
			<div className="col-start-1 row-start-1 w-full h-full pointer-events-auto z-0">
				<div
					ref={containerRef}
					className={cn(
						"absolute top-0 right-0 h-full w-screen touch-none select-none z-0",
						isDragging ? "cursor-grabbing" : "cursor-grab",
					)}
				/>

				{hoveredRel && (
					<div
						className={cn(
							"pointer-events-none fixed z-30 w-max max-w-[min(22rem,calc(100vw-2rem))] rounded-md border border-border/60 bg-popover px-3 py-2 text-left text-popover-foreground shadow-md",
							hoveredRel.side === "top"
								? "-translate-x-1/2 -translate-y-[calc(100%+0.5rem)]"
								: "-translate-x-1/2 translate-y-2",
						)}
						style={{ left: hoveredRel.x, top: hoveredRel.y }}
					>
						<div className="no-scrollbar flex max-h-[min(20rem,calc(100vh-2rem))] max-w-full flex-col gap-1 overflow-y-auto">
							<b className="text-[0.75rem] leading-tight">
								{hoveredRel.link.type?.label}{" "}
								{tooltipValue > 0
									? `+${tooltipValue.toFixed(2)}`
									: tooltipValue.toFixed(2)}
							</b>
							<span className="max-w-full whitespace-normal wrap-break-word text-[0.75rem] leading-snug">
								{hoveredRel.link.rel.description}
							</span>
							<p className="mt-1 text-[10px] italic opacity-45">
								Left-click Edit | Right-click Delete
							</p>
						</div>
					</div>
				)}

				<div className="col-start-1 row-start-1 z-10 w-full h-full flex flex-col justify-between pointer-events-none">
					<header className="w-full p-6 flex items-center justify-between shrink-0 pointer-events-none">
						<div className="bg-background/40 backdrop-blur-md p-4 rounded-2xl pointer-events-auto">
							<h2
								style={{ fontFamily: "Geist Variable" }}
								className="text-4xl font-bold tracking-tighter uppercase italic serif"
							>
								{selectedCharacter?.name || "Select a character"}
							</h2>
							<p className="text-sm opacity-50 max-w-md">
								{selectedCharacter?.description}
							</p>
						</div>

						<Button
							onClick={(event) => {
								event.stopPropagation();
								setEditingRel(null);
								setIsModalOpen(true);
							}}
							className="px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-full flex items-center gap-2 pointer-events-auto z-40"
						>
							<Plus className="w-4 h-4" /> New Relation
						</Button>
					</header>

					<div className="h-full w-min p-6 flex flex-col flex-wrap-reverse justify-start items-start gap-3 pointer-events-none self-end">
						{types.map((type) => (
							<Badge
								variant="secondary"
								key={type.id}
								style={{ "--badge-color": type.color } as React.CSSProperties}
								className="p-2.5 pr-1 bg-card/40 backdrop-blur-md pointer-events-auto border border-foreground/5 transition-all hover:bg-foreground/10"
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

				{selectedId && (
					<RelationshipModal
						fromId={editingRel ? editingRel.fromId : selectedId}
						initialData={editingRel ?? undefined}
						onSave={(newRel) => {
							if (editingRel) updateRelationship(editingRel, newRel);
							else addRelationship(newRel);
						}}
						open={isModalOpen}
						onOpenChange={(open) => {
							if (!open) setEditingRel(null);
							setIsModalOpen(open);
						}}
					/>
				)}
				{deletingRel && (
					<ConfirmModal
						title="Delete Relationship"
						message={`Are you sure you want to delete relationship from ${allChars.find((c) => c.id === deletingRel.fromId)?.name} to ${allChars.find((c) => c.id === deletingRel.toId)?.name}?`}
						onConfirm={() =>
							deleteRelationship(
								deletingRel.fromId,
								deletingRel.toId,
								deletingRel.typeId,
							)
						}
						open={!!deletingRel}
						onOpenChange={(open) => {
							if (!open) setDeletingRel(null);
						}}
					/>
				)}
			</div>
		</div>
	);
}
