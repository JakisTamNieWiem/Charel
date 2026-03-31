import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Relationship } from "@/types";
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
		hoverTimeout.current = setTimeout(() => {
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
	const minRadiusForNoTouch = (relatedCharacters.length * 85) / (2 * Math.PI);
	const radius = Math.max(220, Math.ceil(minRadiusForNoTouch));
	const margin = 150;
	const svgSize = (radius + margin) * 2;
	const centerRadius = 60;
	const relatedRadius = 40;
	const relationshipData = useMemo(() => {
		return relatedCharacters.flatMap((char, i: number) => {
			// Calculate the angle for the group rotation later
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
				const strokeW = 1 + absValue * 3;
				const edgeOpacity = 0.3 + absValue * 0.7;

				// 1. GAP CALCULATION
				// This dictates how many pixels apart the parallel lines will be.
				// 16px is usually perfect for 2px stroke lines.
				const gap = 12;
				const offset = (idx - (rels.length - 1) / 2) * gap;

				// 2. DEFINE X COORDINATES
				const padding = 4;
				const startX = centerRadius + padding;
				const endX = radius - relatedRadius - padding;

				// Determine direction (Left->Right or Right->Left)
				const actualStartX = isFromCenter ? startX : endX;
				const actualEndX = isFromCenter ? endX : startX;

				// 3. THE FIX: Draw perfectly straight parallel lines
				// We shift the entire line UP or DOWN on the Y-axis by the offset.
				const path = `M ${actualStartX} ${offset} L ${actualEndX} ${offset}`;

				// 4. Center point for the tooltip anchor
				const curveMidX = (actualStartX + actualEndX) / 2;
				const curveMidY = offset;

				return {
					rel,
					type,
					path,
					angleDeg,
					curveMidX,
					curveMidY,
					strokeW,
					edgeOpacity,
				};
			});
		});
	}, [selectedId, relatedCharacters, relationships, types, radius]);
	const handleWheel = (e: React.WheelEvent) => {
		const zoomSensitivity = 0.002;
		scaleRef.current = Math.max(
			0.2,
			Math.min(scaleRef.current - e.deltaY * zoomSensitivity, 3),
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
						angleDeg,
						curveMidX,
						curveMidY,
						strokeW,
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
									<Tooltip open={true} disableHoverableContent={true}>
										<TooltipTrigger asChild>
											<circle
												cy={curveMidY}
												cx={curveMidX}
												r="1"
												fill="white"
												className="pointer-events-none!"
											/>
										</TooltipTrigger>
										<TooltipContent
											side={tooltipSide}
											align="center"
											className="pointer-events-none!"
										>
											<div className="h-full max-h-75 w-45 flex flex-col items-center justify-center pointer-events-none!">
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
									d={path}
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
									fill="none"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke={type?.color || "#fff"}
									strokeWidth={strokeW}
									markerEnd={`url(#arrowhead-${rel.typeId})`}
									opacity={
										hoveredRel &&
										`${hoveredRel.fromId}-${hoveredRel.toId}-${hoveredRel.typeId}` ===
											relId
											? 1
											: edgeOpacity
									}
									className="pointer-events-none"
								/>
							</g>
						);
					},
				)}

				{relatedCharacters.map((char, i: number) => {
					const angle = (i / relatedCharacters.length) * 2 * Math.PI;
					const x = radius * Math.cos(angle);
					const y = radius * Math.sin(angle);

					// Position name radially outside the circle
					const textRadius = radius + 70;
					const textX = textRadius * Math.cos(angle);
					const textY = textRadius * Math.sin(angle);

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
								r="42"
								fill="#0a0a0a"
								stroke="white"
								strokeWidth="1"
								className="opacity-20 group-hover:opacity-40 transition-opacity"
							/>
							<clipPath id={`clip-${char.id}`}>
								<circle cx={x} cy={y} r="40" />
							</clipPath>
							<image
								href={
									char.avatar || `https://picsum.photos/seed/${char.id}/80/80`
								}
								x={x - 40}
								y={y - 40}
								width={relatedRadius * 2}
								height={relatedRadius * 2}
								clipPath={`url(#clip-${char.id})`}
								// @ts-expect-error: referrerPolicy is valid on SVGImageElement but missing in React types
								referrerPolicy="no-referrer"
							/>

							<text
								x={textX}
								y={textY}
								textAnchor="middle"
								dominantBaseline="middle"
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
						r="62"
						fill="#0a0a0a"
						stroke="white"
						strokeWidth="2"
					/>
					<clipPath id="clip-center">
						<circle cx={0} cy={0} r="60" />
					</clipPath>
					<image
						href={
							selectedCharacter?.avatar ||
							`https://picsum.photos/seed/${selectedCharacter?.id}/120/120`
						}
						x={-60}
						y={-60}
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
				className="w-full h-full overflow-visible"
				// By setting viewBox to start at -half, 0,0 is exactly in the center!
				viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
			>
				<defs>
					{types.map((t) => (
						<marker
							key={t.id}
							id={`arrowhead-${t.id}`}
							markerWidth="7"
							markerHeight="5"
							refX="7"
							refY="2.5"
							orient="auto"
						>
							<polygon points="0 0, 7 2.5, 0 5" fill={t.color} />
						</marker>
					))}
				</defs>
				{graphSvgContent}
			</svg>
			{editingRel && (
				<RelationshipModal
					fromId={editingRel.fromId}
					initialData={editingRel ?? undefined}
					characters={allChars}
					types={types}
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
