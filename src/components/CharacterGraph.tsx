import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Relationship } from "@/types/types";
import RelationshipModal from "./RelationshipModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export default function CharacterGraph() {
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);

	const allChars = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const types = useGraphStore((state) => state.relationshipTypes);
	const deleteRelationship = useGraphStore((state) => state.deleteRelationship);

	const updateRelationship = useGraphStore((state) => state.updateRelationship);
	const selectedCharacter = useGraphStore((state) =>
		state.characters.find((c) => c.id === state.selectedCharId),
	);

	const relatedCharacters = useMemo(() => {
		if (!selectedId) return [];
		const rels = relationships.filter(
			(r) => r.fromId === selectedId || r.toId === selectedId,
		);
		const ids = new Set(rels.flatMap((r) => [r.fromId, r.toId]));
		ids.delete(selectedId);
		return allChars.filter((c) => ids.has(c.id));
	}, [allChars, relationships, selectedId]);
	const [openRelModal, setOpenRelModal] = useState(false);
	const [editingRel, setEditingRel] = useState<Relationship | null>(null);
	const [hoveredRel, setHoveredRel] = useState<Relationship | null>(null);

	const gRef = useRef<SVGGElement>(null);
	const panRef = useRef({ x: 0, y: 0 });
	const scaleRef = useRef(1);
	const [isDragging, setIsDragging] = useState(false);
	const isDraggingRef = useRef(false); // Sync ref for the event listener
	const svgRef = useRef<SVGSVGElement>(null); // We need a reference to the SVG element
	const dragStartRef = useRef({ x: 0, y: 0 }); // Tracks exact absolute mouse start
	const rafRef = useRef<number | null>(null); // Tracks animation frames for 60fps

	// --- TOOLTIP HOVER STATE ---
	const hoverTimeout = useRef<number>(null);
	const [tooltipSide, setTooltipSide] = useState<"top" | "bottom">("top");

	useEffect(() => {
		return () => {
			if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
		};
	}, []);
	const getMousePositionInSVG = (e: React.PointerEvent) => {
		if (!svgRef.current) return { x: 0, y: 0 };
		const svg = svgRef.current;
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		// The magic line: Converts raw screen pixels to exact SVG viewBox coordinates
		return pt.matrixTransform(svg.getScreenCTM()?.inverse());
	};
	const handleMouseEnterLine = useCallback((rel: Relationship) => {
		if (isDraggingRef.current) return; // Don't show tooltips while dragging
		if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
		setHoveredRel(rel);
	}, []);

	const handleMouseLeaveLine = useCallback(() => {
		hoverTimeout.current = window.setTimeout(() => {
			setHoveredRel(null);
		}, 100);
	}, []);

	// Directly mutate the DOM transform
	const applyTransform = () => {
		if (gRef.current) {
			gRef.current.setAttribute(
				"transform",
				`translate(${panRef.current.x}, ${panRef.current.y}) scale(${scaleRef.current})`,
			);
		}
	};

	// --- LAYOUT MATH ---
	const relatedRadius = 40;
	const maxBundleSize = relatedCharacters.reduce((max, char) => {
		const relCount = relationships.filter(
			(r) =>
				(r.fromId === selectedId && r.toId === char.id) ||
				(r.fromId === char.id && r.toId === selectedId),
		).length;
		return Math.max(max, relCount);
	}, 0);

	const centerRadius = Math.max(
		80,
		60 + relatedCharacters.length * 1.5,
		(maxBundleSize * 16) / 2 + 30,
	);
	const minRadiusForNoTouch =
		(relatedCharacters.length * (relatedRadius * 2 + 7)) / (2 * Math.PI);
	const radius = Math.max(
		220,
		Math.ceil(minRadiusForNoTouch),
		centerRadius + relatedRadius + 100, // At least 100px of breathing room for arrows
	);
	const margin = 150;
	const svgSize = (radius + margin) * 2;
	const relationshipData = useMemo(() => {
		return relatedCharacters.flatMap((char, i: number) => {
			const angleDeg = (i / relatedCharacters.length) * 360;

			const rels = relationships.filter(
				(r) =>
					(r.fromId === selectedId && r.toId === char.id) ||
					(r.fromId === char.id && r.toId === selectedId),
			);
			return rels.map((rel, idx: number) => {
				const isFromCenter = rel.fromId === selectedId;
				const type = types.find((t) => t.id === rel.typeId);

				const typeValue = rel.value ?? type?.value ?? 0;
				const absValue = Math.abs(typeValue);

				// Arrow dimensions based on strength
				const strokeW = 1 + absValue * 2.5;
				const headW = strokeW * 3 + 4; // Width of arrowhead base
				const headL = strokeW * 3.5 + 5; // Length of arrowhead
				const edgeOpacity = 0.3 + absValue * 0.7;

				// Gap between parallel lines
				const gap = strokeW + 8;
				const offset = (idx - (rels.length - 1) / 2) * gap;

				// 1. THE OPTICAL ILLUSION FIX: Exact Circle Intersections
				const R1 = centerRadius + 3;
				const R2 = relatedRadius + 4;

				// Prevent NaN if offset is somehow larger than the circle (edge case)
				const safeOffset1 = Math.min(Math.abs(offset), R1 - 0.1);
				const safeOffset2 = Math.min(Math.abs(offset), R2 - 0.1);

				// Pythagoras: x = sqrt(r^2 - y^2)
				const cxEdge = Math.sqrt(R1 * R1 - safeOffset1 * safeOffset1);
				const oxEdge = radius - Math.sqrt(R2 * R2 - safeOffset2 * safeOffset2);

				const actualStartX = isFromCenter ? cxEdge : oxEdge;
				const actualEndX = isFromCenter ? oxEdge : cxEdge;
				const sign = isFromCenter ? 1 : -1;

				// 2. POLYGON ARROW MATH
				const shaftTop = offset - strokeW / 2;
				const shaftBot = offset + strokeW / 2;
				const headTop = offset - headW / 2;
				const headBot = offset + headW / 2;
				const headBaseX = actualEndX - sign * headL;

				// Draw the 7 points of the solid arrow shape
				const path = `M ${actualStartX},${shaftTop} 
				              L ${headBaseX},${shaftTop} 
				              L ${headBaseX},${headTop} 
				              L ${actualEndX},${offset} 
				              L ${headBaseX},${headBot} 
				              L ${headBaseX},${shaftBot} 
				              L ${actualStartX},${shaftBot} Z`;

				// We create a simple straight line just for the invisible hover hitbox
				const hitboxPath = `M ${actualStartX} ${offset} L ${actualEndX} ${offset}`;

				const curveMidX = (actualStartX + actualEndX) / 2;
				const curveMidY = offset;

				return {
					rel,
					type,
					path,
					hitboxPath,
					angleDeg,
					curveMidX,
					curveMidY,
					edgeOpacity,
				};
			});
		});
	}, [
		selectedId,
		relatedCharacters,
		relationships,
		types,
		radius,
		centerRadius,
	]);
	const handleWheel = (e: React.WheelEvent) => {
		const zoomSensitivity = 0.002;
		scaleRef.current = Math.max(
			0.2,
			Math.min(scaleRef.current - e.deltaY * zoomSensitivity, 4),
		);
		applyTransform();
	};
	const graphSvgContent = useMemo(() => {
		return (
			<g ref={gRef} transform="translate(0, 0) scale(1)">
				{relationshipData.map(
					({
						rel,
						type,
						path,
						hitboxPath,
						angleDeg,
						curveMidX,
						curveMidY,
						edgeOpacity,
					}) => {
						const relId = `${rel.fromId}-${rel.toId}-${rel.typeId}`;
						const isActive =
							hoveredRel &&
							`${hoveredRel.fromId}-${hoveredRel.toId}-${hoveredRel.typeId}` ===
								relId;
						return (
							<g
								key={`rel-path-${relId}`}
								className="cursor-help"
								transform={` rotate(${angleDeg})`}
							>
								{isActive && (
									<Tooltip open={true}>
										<TooltipTrigger
											render={
												<circle
													cy={curveMidY}
													cx={curveMidX}
													r="1"
													fill="transparent"
													className="pointer-events-none!"
												/>
											}
										></TooltipTrigger>
										<TooltipContent
											side={tooltipSide}
											align="center"
											className="pointer-events-none!"
										>
											<div className="h-full max-h-75 w-45 flex flex-col items-center justify-center pointer-events-none!">
												<b>
													{types.find((t) => t.id === hoveredRel.typeId)?.label}{" "}
													{hoveredRel.value && hoveredRel?.value > 0
														? `+${hoveredRel.value.toFixed(2)}`
														: (hoveredRel.value?.toFixed(2) ??
															types
																.find((t) => t.id === hoveredRel.typeId)
																?.value.toFixed(2) ??
															"+0.--")}
												</b>
												<span className="leading-tight pointer-events-none!">
													{hoveredRel.description}
												</span>

												<p className="mt-1 text-[10px] opacity-40 italic pointer-events-none!">
													Left-click Edit | Right-click Delete
												</p>
											</div>
										</TooltipContent>
									</Tooltip>
								)}
								{/* Invisible trigger path */}
								<path
									d={hitboxPath}
									fill="none"
									stroke="transparent"
									strokeWidth="16"
									className="pointer-events-auto"
									onMouseMove={(e) => {
										// We need to find the screen position of the midpoint of the line
										// We can get this from the path itself or the parent G element
										const pathElement = e.currentTarget;
										const bbox = pathElement.getBoundingClientRect();
										const mouseY = e.clientY;

										// If mouse is above the vertical center of the path's bounding box,
										// we want the tooltip to be at the bottom (so it doesn't block the line)
										// If mouse is below, we want it at the top.
										const midY = bbox.top + bbox.height / 2;
										setTooltipSide(mouseY < midY ? "bottom" : "top");

										handleMouseEnterLine(rel);
									}}
									onMouseEnter={(e) => {
										e.preventDefault();
										handleMouseEnterLine(rel);
									}}
									onMouseLeave={(e) => {
										e.preventDefault();
										e.stopPropagation();
										handleMouseLeaveLine();
									}}
									onPointerDown={(e) => {
										if (e.pointerType === "mouse" && e.button === 2) return;
										e.preventDefault();
										e.stopPropagation();
										setEditingRel(rel);
										setOpenRelModal(true);
									}}
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										deleteRelationship(rel.fromId, rel.toId, rel.typeId);
									}}
								/>
								{/* Visible path */}
								<path
									d={path}
									fill={type?.color || "#fff"}
									opacity={isActive ? 1 : edgeOpacity}
									className="pointer-events-none transition-opacity"
								/>
							</g>
						);
					},
				)}

				{relatedCharacters.map((char, i: number) => {
					const angle = (i / relatedCharacters.length) * 2 * Math.PI;
					const cos = Math.cos(angle);
					const sin = Math.sin(angle);
					const x = radius * cos;
					const y = radius * sin;

					// Position name radially outside the circle
					const textRadius = radius + relatedRadius + 16;
					const textX = textRadius * cos;
					const textY = textRadius * sin;
					const textAnchor =
						cos > 0.5 ? "start" : cos < -0.5 ? "end" : "middle";
					const dominantBaseline =
						sin > 0.5 ? "hanging" : sin < -0.5 ? "auto" : "middle";

					return (
						<g
							key={char.id}
							onPointerDown={(e) => {
								e.stopPropagation();
								setSelectedCharId(char.id);
							}}
							className="cursor-pointer group"
						>
							<circle
								cx={x}
								cy={y}
								r={relatedRadius + 2}
								fill="#0a0a0a"
								stroke="white"
								strokeWidth="1"
								className="opacity-20 group-hover:opacity-40 transition-opacity"
							/>
							<clipPath id={`clip-${char.id}`}>
								<circle cx={x} cy={y} r={relatedRadius} />
							</clipPath>
							<image
								href={
									char.avatar || `https://picsum.photos/seed/${char.id}/80/80`
								}
								x={x - relatedRadius}
								y={y - relatedRadius}
								width={relatedRadius * 2}
								height={relatedRadius * 2}
								clipPath={`url(#clip-${char.id})`}
								// @ts-expect-error: referrerPolicy is valid on SVGImageElement but missing in React types
								referrerPolicy="no-referrer"
							/>

							<text
								x={textX}
								y={textY}
								textAnchor={textAnchor}
								dominantBaseline={dominantBaseline}
								className="fill-white text-[10px] font-bold uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none"
							>
								{char.name}
							</text>
						</g>
					);
				})}

				<g className="drop-shadow-2xl">
					<circle
						cx={0}
						cy={0}
						r={centerRadius + 2}
						fill="#0a0a0a"
						stroke="white"
						strokeWidth="2"
					/>
					<clipPath id="clip-center">
						<circle cx={0} cy={0} r={centerRadius} />
					</clipPath>
					<image
						href={
							selectedCharacter?.avatar ||
							`https://picsum.photos/seed/${selectedCharacter?.id}/120/120`
						}
						x={-centerRadius}
						y={-centerRadius}
						width={centerRadius * 2}
						height={centerRadius * 2}
						clipPath="url(#clip-center)"
						// @ts-expect-error: referrerPolicy is valid on SVGImageElement but missing in React types
						referrerPolicy="no-referrer"
					/>
				</g>
			</g>
		);
	}, [
		// 1. Data dependencies (These DO change and should trigger redraws)
		relationshipData,
		relatedCharacters,
		hoveredRel,
		selectedCharacter,
		radius,

		// 2. Cached Hover Functions (Now stable thanks to useCallback)
		handleMouseEnterLine,
		handleMouseLeaveLine,
		deleteRelationship,
		setSelectedCharId,
		tooltipSide,
		types.find,
		centerRadius,
	]);
	return (
		<div
			className={cn(
				"w-full h-full overflow-hidden touch-none select-none",
				isDragging ? "cursor-grabbing" : "cursor-grab",
			)}
			onWheel={handleWheel}
			onPointerDown={(e) => {
				if (openRelModal) return;
				setIsDragging(true);
				isDraggingRef.current = true;
				setHoveredRel(null);
				e.currentTarget.setPointerCapture(e.pointerId);
				const svgPt = getMousePositionInSVG(e);
				dragStartRef.current = {
					x: svgPt.x - panRef.current.x,
					y: svgPt.y - panRef.current.y,
				};
			}}
			onPointerMove={(e) => {
				if (!isDraggingRef.current) return;
				// 2. Calculate the exact new position
				const svgPt = getMousePositionInSVG(e);
				panRef.current.x = svgPt.x - dragStartRef.current.x;
				panRef.current.y = svgPt.y - dragStartRef.current.y;

				// 3. 60 FPS Optimization (Debounce DOM updates to screen refresh rate)
				if (!rafRef.current) {
					rafRef.current = requestAnimationFrame(() => {
						applyTransform();
						rafRef.current = null;
					});
				}
			}}
			onPointerUp={() => {
				setIsDragging(false);
				isDraggingRef.current = false;
				if (rafRef.current) cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}}
			onPointerCancel={() => {
				setIsDragging(false);
				isDraggingRef.current = false;
			}}
		>
			<svg
				ref={svgRef}
				className="h-full w-full overflow-visible"
				// By setting viewBox to start at -half, 0,0 is exactly in the center!
				viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
			>
				{graphSvgContent}
			</svg>
			{editingRel && (
				<RelationshipModal
					fromId={editingRel.fromId}
					initialData={editingRel ?? undefined}
					onSave={(newRel) => updateRelationship(editingRel, newRel)}
					open={openRelModal}
					onOpenChange={(open) => {
						setOpenRelModal(open);
						setEditingRel(null);
					}}
				/>
			)}
		</div>
	);
}
