import {
	type Application,
	Container,
	type ContainerChild,
	Graphics,
	Sprite,
	Text,
	type TextOptions,
	type Texture,
} from "pixi.js";
import {
	type ComputedLink,
	getViewportBounds,
	isCircleVisible,
	isLinkVisible,
	type LayoutData,
	NODE_SIZE,
} from "@/lib/network-graph";
import { getAvatarTexture } from "@/lib/pixi-avatar-cache";

const GLOW_SPEED = 0.25;
const GLOW_SPREAD = 0.18;
const GLOW_STEPS = 96;
const GLOW_EDGE_FADE_RANGE = 0.12;
const GLOW_BASE_COLOR_SCALE = 0.42;
const LINK_STRAIGHT_SCREEN_WIDTH = 0.9;
const LINK_CURVED_SCREEN_WIDTH = 1.2;
const TEXT_TEXTURE_OVERSAMPLE = 1.5;
const MAX_TEXT_TEXTURE_RESOLUTION = 8;
const GROUP_LABEL_FONT_SIZE = 22;
const GROUP_LABEL_OFFSET = 25;
const NODE_INITIAL_FONT_SIZE = NODE_SIZE * 0.8;
const NODE_LABEL_FONT_SIZE = 11;
const NODE_LABEL_OFFSET = 8;

type ThemeColors = {
	bg: number;
	fg: number;
	card: number;
};

type PixiLayers = {
	world: Container;
	groups: Container;
	links: Container;
	fx: Graphics;
	nodes: Container;
	labels: Container;
};

type EngineState = {
	app: Application | null;
	layers: PixiLayers | null;
	canvas: HTMLCanvasElement | null;
	transform: { x: number; y: number; k: number };
	width: number;
	height: number;
	theme: ThemeColors;
	hoveredNodeId: string | null;
	hoveredGroupId: string | null;
	connectedNodeIds: Set<string>;
	isDragging: boolean;
	isInteracting: boolean;
	hasCentered: boolean;
	pointerDownPos: { x: number; y: number };
	lastPointerPos: { x: number; y: number };
	layout: LayoutData;
	staticDirty: boolean;
	fxDirty: boolean;
	activeEffects: boolean;
	animFrameId: number;
	settleTimer: number | null;
};

function radialAnchorX(cos: number) {
	return cos > 0.5 ? 0 : cos < -0.5 ? 1 : 0.5;
}

function radialAnchorY(sin: number) {
	return sin > 0.5 ? 0 : sin < -0.5 ? 1 : 0.5;
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

function sampleCubic(
	sx: number,
	sy: number,
	cp1X: number,
	cp1Y: number,
	cp2X: number,
	cp2Y: number,
	ex: number,
	ey: number,
	t: number,
): [number, number] {
	const t1 = 1 - t;

	return [
		t1 ** 3 * sx + 3 * t1 * t1 * t * cp1X + 3 * t1 * t * t * cp2X + t ** 3 * ex,
		t1 ** 3 * sy + 3 * t1 * t1 * t * cp1Y + 3 * t1 * t * t * cp2Y + t ** 3 * ey,
	];
}

function samplePolyline(
	points: Array<{ x: number; y: number }>,
	t: number,
): [number, number] {
	if (points.length === 0) {
		return [0, 0];
	}

	if (points.length === 1) {
		return [points[0].x, points[0].y];
	}

	const scaled = clamp(t) * (points.length - 1);
	const index = Math.min(Math.floor(scaled), points.length - 2);
	const localT = scaled - index;
	const start = points[index];
	const end = points[index + 1];

	return [
		start.x + (end.x - start.x) * localT,
		start.y + (end.y - start.y) * localT,
	];
}

function sampleLink(link: ComputedLink, t: number): [number, number] {
	if (
		link.curveStyle === "cubic" &&
		link.cp1X != null &&
		link.cp1Y != null &&
		link.cp2X != null &&
		link.cp2Y != null
	) {
		return sampleCubic(
			link.source.x,
			link.source.y,
			link.cp1X,
			link.cp1Y,
			link.cp2X,
			link.cp2Y,
			link.target.x,
			link.target.y,
			t,
		);
	}

	if (link.curveStyle === "sine" && link.waveAmplitude != null) {
		const dx = link.target.x - link.source.x;
		const dy = link.target.y - link.source.y;
		const distance = Math.hypot(dx, dy) || 1;
		const normalX = -dy / distance;
		const normalY = dx / distance;
		const phase = link.wavePhase ?? 0;
		const waves = link.waveCount ?? 1;
		const displacement =
			Math.sin(t * Math.PI * waves + phase) *
			Math.sin(t * Math.PI) *
			link.waveAmplitude;

		return [
			link.source.x + dx * t + normalX * displacement,
			link.source.y + dy * t + normalY * displacement,
		];
	}

	if (link.curveStyle === "fractal" && link.pathPoints) {
		return samplePolyline(link.pathPoints, t);
	}

	if (link.cpX != null && link.cpY != null) {
		return sampleQuadratic(
			link.source.x,
			link.source.y,
			link.cpX,
			link.cpY,
			link.target.x,
			link.target.y,
			t,
		);
	}

	return [
		link.source.x + (link.target.x - link.source.x) * t,
		link.source.y + (link.target.y - link.source.y) * t,
	];
}

function drawSampledPath(graphics: Graphics, link: ComputedLink, steps = 32) {
	graphics.beginPath();
	const [startX, startY] = sampleLink(link, 0);

	graphics.moveTo(startX, startY);

	for (let index = 1; index <= steps; index += 1) {
		const [x, y] = sampleLink(link, index / steps);
		graphics.lineTo(x, y);
	}
}

function screenWidthToWorld(width: number, scale: number) {
	return width / Math.max(scale, 0.001);
}

function drawLinkPath(graphics: Graphics, link: ComputedLink) {
	if (
		link.curveStyle === "cubic" &&
		link.cp1X != null &&
		link.cp1Y != null &&
		link.cp2X != null &&
		link.cp2Y != null
	) {
		graphics
			.beginPath()
			.moveTo(link.source.x, link.source.y)
			.bezierCurveTo(
				link.cp1X,
				link.cp1Y,
				link.cp2X,
				link.cp2Y,
				link.target.x,
				link.target.y,
			);
	} else if (
		link.curveStyle === "sine" ||
		(link.curveStyle === "fractal" && link.pathPoints)
	) {
		drawSampledPath(graphics, link, link.curveStyle === "fractal" ? 16 : 40);
	} else {
		graphics.beginPath();
		graphics.moveTo(link.source.x, link.source.y);

		if (link.cpX != null && link.cpY != null) {
			graphics.quadraticCurveTo(
				link.cpX,
				link.cpY,
				link.target.x,
				link.target.y,
			);
		} else {
			graphics.lineTo(link.target.x, link.target.y);
		}
	}

	return graphics;
}

function clamp(value: number, min = 0, max = 1) {
	return Math.min(Math.max(value, min), max);
}

function srgbChannelToByte(value: number) {
	const clamped = clamp(value);
	const srgb =
		clamped <= 0.0031308
			? clamped * 12.92
			: 1.055 * clamped ** (1 / 2.4) - 0.055;

	return Math.round(clamp(srgb) * 255);
}

function packRgb(red: number, green: number, blue: number) {
	return (red << 16) + (green << 8) + blue;
}

function scaleRgbColor(color: number, scale: number) {
	return packRgb(
		Math.round(((color >> 16) & 255) * scale),
		Math.round(((color >> 8) & 255) * scale),
		Math.round((color & 255) * scale),
	);
}

function parseHexColor(value: string) {
	const hex = value.replace("#", "").trim();

	if (hex.length === 3 || hex.length === 4) {
		return packRgb(
			Number.parseInt(hex[0] + hex[0], 16),
			Number.parseInt(hex[1] + hex[1], 16),
			Number.parseInt(hex[2] + hex[2], 16),
		);
	}

	if (hex.length === 6 || hex.length === 8) {
		return Number.parseInt(hex.slice(0, 6), 16);
	}

	return null;
}

function parseRgbColor(value: string) {
	const match = value.match(/^rgba?\((.+)\)$/i);

	if (!match) {
		return null;
	}

	const channels = match[1]
		.replace(/\//g, " ")
		.split(/[,\s]+/)
		.filter(Boolean)
		.slice(0, 3)
		.map((channel) => {
			if (channel.endsWith("%")) {
				return Math.round((Number.parseFloat(channel) / 100) * 255);
			}

			return Math.round(Number.parseFloat(channel));
		});

	if (
		channels.length < 3 ||
		channels.some((channel) => Number.isNaN(channel))
	) {
		return null;
	}

	return packRgb(
		clamp(channels[0], 0, 255),
		clamp(channels[1], 0, 255),
		clamp(channels[2], 0, 255),
	);
}

function hueToRgb(p: number, q: number, t: number) {
	let adjustedT = t;

	if (adjustedT < 0) adjustedT += 1;
	if (adjustedT > 1) adjustedT -= 1;
	if (adjustedT < 1 / 6) return p + (q - p) * 6 * adjustedT;
	if (adjustedT < 1 / 2) return q;
	if (adjustedT < 2 / 3) return p + (q - p) * (2 / 3 - adjustedT) * 6;
	return p;
}

function parseHue(value: string) {
	if (value.endsWith("turn")) {
		return Number.parseFloat(value) * 360;
	}

	if (value.endsWith("rad")) {
		return Number.parseFloat(value) * (180 / Math.PI);
	}

	if (value.endsWith("deg")) {
		return Number.parseFloat(value);
	}

	return Number.parseFloat(value);
}

function parseHslColor(value: string) {
	const match = value.match(/^hsla?\((.+)\)$/i);

	if (!match) {
		return null;
	}

	const parts = match[1]
		.replace(/\//g, " ")
		.split(/[,\s]+/)
		.filter(Boolean);

	if (parts.length < 3) {
		return null;
	}

	const hue = parseHue(parts[0]);
	const saturation = Number.parseFloat(parts[1]) / 100;
	const lightness = Number.parseFloat(parts[2]) / 100;

	if ([hue, saturation, lightness].some((part) => Number.isNaN(part))) {
		return null;
	}

	const normalizedHue = (((hue % 360) + 360) % 360) / 360;
	const clampedSaturation = clamp(saturation);
	const clampedLightness = clamp(lightness);

	if (clampedSaturation === 0) {
		const grey = Math.round(clampedLightness * 255);
		return packRgb(grey, grey, grey);
	}

	const q =
		clampedLightness < 0.5
			? clampedLightness * (1 + clampedSaturation)
			: clampedLightness +
				clampedSaturation -
				clampedLightness * clampedSaturation;
	const p = 2 * clampedLightness - q;

	return packRgb(
		Math.round(hueToRgb(p, q, normalizedHue + 1 / 3) * 255),
		Math.round(hueToRgb(p, q, normalizedHue) * 255),
		Math.round(hueToRgb(p, q, normalizedHue - 1 / 3) * 255),
	);
}

function parseOklchColor(value: string) {
	const match = value.match(/^oklch\((.+)\)$/i);

	if (!match) {
		return null;
	}

	const parts = match[1].replace(/\//g, " ").split(/\s+/).filter(Boolean);

	if (parts.length < 3) {
		return null;
	}

	const lightness = parts[0].endsWith("%")
		? Number.parseFloat(parts[0]) / 100
		: Number.parseFloat(parts[0]);
	const chroma = Number.parseFloat(parts[1]);
	const huePart = parts[2];
	const hue = huePart.endsWith("turn")
		? Number.parseFloat(huePart) * 360
		: huePart.endsWith("rad")
			? Number.parseFloat(huePart) * (180 / Math.PI)
			: Number.parseFloat(huePart);

	if ([lightness, chroma, hue].some((part) => Number.isNaN(part))) {
		return null;
	}

	const hueRadians = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(hueRadians);
	const b = chroma * Math.sin(hueRadians);
	const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
	const l = lPrime ** 3;
	const m = mPrime ** 3;
	const s = sPrime ** 3;

	return packRgb(
		srgbChannelToByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		srgbChannelToByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		srgbChannelToByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	);
}

function colorToNumber(value: string | null | undefined, fallback: number) {
	const color = value?.trim();

	if (!color) {
		return fallback;
	}

	if (color.startsWith("#")) {
		return parseHexColor(color) ?? fallback;
	}

	if (color.startsWith("oklch(")) {
		return parseOklchColor(color) ?? fallback;
	}

	if (color.startsWith("rgb")) {
		return parseRgbColor(color) ?? fallback;
	}

	if (color.startsWith("hsl")) {
		return parseHslColor(color) ?? fallback;
	}

	return fallback;
}

function getTextResolution(scale: number) {
	const dpr = window.devicePixelRatio || 1;

	return Math.min(
		Math.max(dpr, dpr * Math.max(scale, 1) * TEXT_TEXTURE_OVERSAMPLE),
		MAX_TEXT_TEXTURE_RESOLUTION,
	);
}

function syncWorldTransform(engine: EngineState) {
	if (!engine.layers) {
		return;
	}

	engine.layers.world.position.set(engine.transform.x, engine.transform.y);
	engine.layers.world.scale.set(engine.transform.k);
}

function clearLayer(layer: Container) {
	const children = layer.removeChildren();

	for (const child of children) {
		child.destroy({ children: true });
	}
}

function addText(
	layer: Container,
	text: string,
	x: number,
	y: number,
	anchorX: number,
	anchorY: number,
	renderScale: number,
	style: TextOptions["style"],
	alpha = 1,
) {
	const label = new Text({
		text,
		anchor: { x: anchorX, y: anchorY },
		resolution: getTextResolution(renderScale),
		style,
	});

	label.x = x;
	label.y = y;
	label.alpha = alpha;
	layer.addChild(label);

	return label;
}

function addAvatarSprite(
	layer: Container,
	avatarTexture: Texture,
	x: number,
	y: number,
	alpha: number,
) {
	try {
		const diameter = (NODE_SIZE - 1) * 2;
		const mask = new Graphics()
			.circle(x, y, NODE_SIZE - 1)
			.fill({ color: 0xffffff });
		const sprite = new Sprite(avatarTexture);
		const fitAvatar = () => {
			if (sprite.destroyed) {
				return;
			}

			const textureWidth = sprite.texture.width || diameter;
			const textureHeight = sprite.texture.height || diameter;
			const scale = Math.max(diameter / textureWidth, diameter / textureHeight);

			sprite.scale.set(scale);
		};

		sprite.anchor.set(0.5);
		sprite.x = x;
		sprite.y = y;
		sprite.alpha = alpha;
		sprite.mask = mask;
		fitAvatar();

		layer.addChild(mask, sprite);
	} catch {
		// Bad user-provided image data should not take down the graph.
	}
}

function drawStaticScene(engine: EngineState, scheduleRender?: () => void) {
	const layers = engine.layers;

	if (!layers || engine.width <= 0 || engine.height <= 0) {
		return;
	}

	syncWorldTransform(engine);
	clearLayer(layers.groups);
	clearLayer(layers.links);
	clearLayer(layers.nodes);
	clearLayer(layers.labels);

	const { x: tx, y: ty, k } = engine.transform;
	const bounds = getViewportBounds(
		engine.transform,
		engine.width,
		engine.height,
	);
	const { theme, hoveredNodeId, hoveredGroupId, connectedNodeIds } = engine;
	const shouldCull = !engine.isInteracting;
	const groupGraphics = new Graphics();
	const linkGraphics = new Graphics();
	const nodeGraphics = new Graphics();

	layers.groups.addChild(groupGraphics);
	layers.links.addChild(linkGraphics);
	layers.nodes.addChild(nodeGraphics);

	for (const group of engine.layout.groups) {
		const isHovered = hoveredGroupId === group.id;

		if (
			(shouldCull && k < 0.03 && !isHovered) ||
			(shouldCull &&
				!isCircleVisible(bounds, group.cx, group.cy, group.radius + 60))
		) {
			continue;
		}

		const groupColor = colorToNumber(group.color, 0xffffff);

		groupGraphics
			.circle(group.cx, group.cy, group.radius)
			.fill({ color: groupColor, alpha: isHovered ? 0.15 : 0.035 });

		if (isHovered || k > 0.1) {
			const cos = Math.cos(group.angle);
			const sin = Math.sin(group.angle);
			const labelDist = group.radius + GROUP_LABEL_OFFSET;

			addText(
				layers.labels,
				group.name.toUpperCase(),
				group.cx + labelDist * cos,
				group.cy + labelDist * sin,
				radialAnchorX(cos),
				radialAnchorY(sin),
				k,
				{
					fill: groupColor,
					fontFamily: "sans-serif",
					fontSize: GROUP_LABEL_FONT_SIZE,
					fontWeight: "700",
				},
				isHovered ? 0.9 : 0.4,
			);
		}
	}

	for (const link of engine.layout.links) {
		if (shouldCull && !isLinkVisible(bounds, link, 32)) {
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

		const linkColor = colorToNumber(link.color, 0x555555);
		const renderedLinkColor =
			engine.activeEffects && isNodeActive
				? scaleRgbColor(linkColor, GLOW_BASE_COLOR_SCALE)
				: linkColor;
		const screenWidth =
			link.cpX != null ? LINK_CURVED_SCREEN_WIDTH : LINK_STRAIGHT_SCREEN_WIDTH;

		drawLinkPath(linkGraphics, link);
		linkGraphics.stroke({
			color: renderedLinkColor,
			alpha: opacity * 0.65,
			width: screenWidthToWorld(screenWidth, k),
			cap: "round",
			join: "round",
		});
	}

	for (const node of engine.layout.nodes) {
		const isHovered = node.id === hoveredNodeId;
		const isGroupHovered = node.groupId === hoveredGroupId;
		const isConnected = connectedNodeIds.has(node.id);
		const isHighlighted = isHovered || isGroupHovered || isConnected;

		if (
			shouldCull &&
			!isCircleVisible(bounds, node.x, node.y, NODE_SIZE + 48) &&
			(!isHighlighted || k < 0.3)
		) {
			continue;
		}

		const rx = Math.round(node.x);
		const ry = Math.round(node.y);
		const nodeColor = colorToNumber(node.color, 0xffffff);

		if (k < 0.05 && !isHighlighted) {
			nodeGraphics.circle(rx, ry, 3).fill({ color: nodeColor, alpha: 1 });
			continue;
		}

		const nodeAlpha =
			!hoveredNodeId && !hoveredGroupId ? 1 : isHighlighted ? 1 : 0.05;

		nodeGraphics
			.circle(rx, ry, NODE_SIZE)
			.fill({ color: theme.card, alpha: nodeAlpha })
			.stroke({
				color: isHovered || isConnected ? theme.fg : nodeColor,
				alpha: nodeAlpha,
				width: Math.min(isHovered || isConnected ? 3 / k : 1.5 / k, 4),
			});

		const drawInitials = () => {
			addText(
				layers.nodes,
				node.initials,
				rx,
				ry,
				0.5,
				0.5,
				k,
				{
					fill: theme.fg,
					fontFamily: "sans-serif",
					fontSize: NODE_INITIAL_FONT_SIZE,
					fontWeight: "700",
				},
				nodeAlpha,
			);
		};

		if (node.avatar) {
			const avatar = getAvatarTexture(node.avatar, () => {
				if (!engine.app || !engine.layers) {
					return;
				}

				engine.staticDirty = true;
				scheduleRender?.();
			});

			if (avatar.texture) {
				addAvatarSprite(layers.nodes, avatar.texture, rx, ry, nodeAlpha);
			} else if (avatar.failed) {
				drawInitials();
			}
		} else {
			drawInitials();
		}

		if (k > 0.3) {
			const dx = rx - node.groupCx;
			const dy = ry - node.groupCy;
			const distance = Math.sqrt(dx * dx + dy * dy) || 1;
			const cos = dx / distance;
			const sin = dy / distance;
			const textDist = NODE_SIZE + NODE_LABEL_OFFSET;

			addText(
				layers.labels,
				node.name,
				rx + textDist * cos,
				ry + textDist * sin,
				radialAnchorX(cos),
				radialAnchorY(sin),
				k,
				{
					fill: theme.fg,
					fontFamily: "sans-serif",
					fontSize: NODE_LABEL_FONT_SIZE,
					fontWeight: "500",
				},
				nodeAlpha,
			);
		}
	}

	layers.world.position.set(tx, ty);
	layers.world.scale.set(k);
}

function drawFxLayer(engine: EngineState) {
	const layers = engine.layers;

	if (!layers) {
		return;
	}

	layers.fx.clear();

	if (!engine.activeEffects || !engine.hoveredNodeId) {
		return;
	}

	const { k } = engine.transform;
	const hoveredNodeId = engine.hoveredNodeId;
	const bounds = getViewportBounds(
		engine.transform,
		engine.width,
		engine.height,
	);
	const timeSeconds = performance.now() * 0.001;
	const glowCenter = (timeSeconds * GLOW_SPEED) % 1;

	for (const link of engine.layout.links) {
		if (hoveredNodeId !== link.sourceId && hoveredNodeId !== link.targetId) {
			continue;
		}

		if (!isLinkVisible(bounds, link, 32)) {
			continue;
		}

		const linkColor = colorToNumber(link.color, 0x555555);
		const baseLinkColor = scaleRgbColor(linkColor, GLOW_BASE_COLOR_SCALE);
		const segmentPad = 0.35 / GLOW_STEPS;

		drawLinkPath(layers.fx, link);
		layers.fx.stroke({
			color: baseLinkColor,
			alpha: 0.2,
			width: screenWidthToWorld(6, k),
			cap: "round",
			join: "round",
		});

		drawLinkPath(layers.fx, link);
		layers.fx.stroke({
			color: baseLinkColor,
			alpha: 0.45,
			width: screenWidthToWorld(1.4, k),
			cap: "round",
			join: "round",
		});

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

			const [x0, y0] = sampleLink(link, Math.max(0, t0 - segmentPad));
			const [x1, y1] = sampleLink(link, Math.min(1, t1 + segmentPad));

			layers.fx
				.beginPath()
				.moveTo(x0, y0)
				.lineTo(x1, y1)
				.stroke({
					color: linkColor,
					alpha: glow * 0.14,
					width: screenWidthToWorld(5.5, k),
					cap: "butt",
					join: "round",
				})
				.beginPath()
				.moveTo(x0, y0)
				.lineTo(x1, y1)
				.stroke({
					color: linkColor,
					alpha: glow * 0.6,
					width: screenWidthToWorld(1.7, k),
					cap: "butt",
					join: "round",
				});
		}
	}
}

function createLayers() {
	const world = new Container();
	const groups = new Container();
	const links = new Container();
	const fx = new Graphics();
	const nodes = new Container();
	const labels = new Container();

	world.addChild(groups, links, fx, nodes, labels);

	return { world, groups, links, fx, nodes, labels };
}

function destroyLayers(layers: PixiLayers) {
	const children: ContainerChild[] = [
		layers.groups,
		layers.links,
		layers.fx,
		layers.nodes,
		layers.labels,
	];

	for (const child of children) {
		child.destroy({ children: true });
	}

	layers.world.destroy({ children: true });
}

export type { EngineState };
export {
	colorToNumber,
	createLayers,
	destroyLayers,
	drawFxLayer,
	drawStaticScene,
	syncWorldTransform,
};
