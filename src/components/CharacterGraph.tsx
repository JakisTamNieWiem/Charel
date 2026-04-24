import { Plus } from "lucide-react";
import {
	Fragment,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Relationship } from "@/types/types";
import ConfirmModal from "./ConfirmModal";
import RelationshipModal from "./RelationshipModal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export default function CharacterGraph() {
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);

	const allChars = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const types = useGraphStore((state) => state.relationshipTypes);
	const addRelationship = useGraphStore((state) => state.addRelationship); // Added for New Relation
	const updateRelationship = useGraphStore((state) => state.updateRelationship);
	const deleteRelationship = useGraphStore((state) => state.deleteRelationship);

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
		return allChars
			.filter((c) => ids.has(c.id))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [allChars, relationships, selectedId]);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingRel, setEditingRel] = useState<Relationship | null>(null);
	const [deletingRel, setDeletingRel] = useState<Relationship | null>(null);

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
	const handleMouseEnterTooltip = useCallback(() => {
		if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
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
			const angleDeg = (i / relatedCharacters.length) * 360 - 90;

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

				// Line thickness based on strength
				const strokeW = 1.5 + absValue * 2.5;
				const edgeOpacity = 0.4 + absValue * 0.6;

				// Curvature calculation
				// If there is only 1 relationship, it's a straight line (gap = 0)
				// If there are 2, they bow away from each other!
				const gap = 20;
				const bowOffset = (idx - (rels.length - 1) / 2) * gap;

				// If bowOffset is 0, we set it to a tiny number (0.01) so it's not "zero"
				const effectiveOffset = bowOffset === 0 ? 0.01 : bowOffset;

				// Add visual padding so arrows don't clip into the avatars
				const startX = centerRadius + 8;
				const endX = radius - relatedRadius - 8;

				// The control point for the curve (Pulls the line up or down)
				const cpX = (startX + endX) / 2;
				const cpY = effectiveOffset * 2.5; // Multiply for a nicer, wider arc

				// Draw all paths from Center to Outer. We will use marker direction to show flow.
				const path = `M ${startX} 0 Q ${cpX} ${cpY} ${endX} 0`;

				// Exact mathematical center of the quadratic curve (for the Tooltip anchor)
				const curveMidX = (startX + endX) / 2;
				const curveMidY = cpY / 2;

				return {
					rel,
					type,
					idx,
					path,
					isFromCenter,
					angleDeg,
					curveMidX,
					curveMidY,
					strokeW,
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
						idx,
						path,
						isFromCenter,
						angleDeg,
						curveMidX,
						curveMidY,

						edgeOpacity,
					}) => {
						const relId = `${rel.fromId}-${rel.toId}-${rel.typeId}-${idx}`;
						const isActive =
							hoveredRel &&
							`${hoveredRel.fromId}-${hoveredRel.toId}-${hoveredRel.typeId}-${idx}` ===
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
											sideOffset={2}
											onMouseEnter={handleMouseEnterTooltip}
											onMouseLeave={handleMouseLeaveLine}
											className="w-max max-w-[min(22rem,calc(100vw-2rem))] items-start whitespace-normal wrap-break-word rounded-md px-3 py-2 text-left leading-snug"
										>
											<div className="no-scrollbar flex max-h-[min(20rem,calc(100vh-2rem))] max-w-full flex-col gap-1 overflow-y-auto">
												<b className="text-[0.75rem] leading-tight">
													{types.find((t) => t.id === hoveredRel.typeId)?.label}{" "}
													{hoveredRel.value && hoveredRel?.value > 0
														? `+${hoveredRel.value.toFixed(2)}`
														: (hoveredRel.value?.toFixed(2) ??
															types
																.find((t) => t.id === hoveredRel.typeId)
																?.value.toFixed(2) ??
															"+0.--")}
												</b>
												<span className="max-w-full whitespace-normal wrap-break-word text-[0.75rem] leading-snug">
													{hoveredRel.description}
												</span>

												<p className="mt-1 text-[10px] italic opacity-45">
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
									className="pointer-events-auto cursor-help"
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
									}}
									onPointerUp={(e) => {
										// 2. OPEN THE MODAL HERE!
										// The click cycle is finished, so the overlay won't misinterpret the mouse release.
										if (e.pointerType === "mouse" && e.button === 2) return;
										e.preventDefault();
										e.stopPropagation();
										setIsModalOpen(true);
									}}
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setDeletingRel(rel);
									}}
								/>
								{/* Visible path */}
								<path
									d={path}
									fill="none"
									strokeLinecap="round"
									strokeWidth="4"
									// 1. Choose gradient based on direction
									stroke={
										isFromCenter
											? `url(#grad-out-${type?.id})`
											: `url(#grad-in-${type?.id})`
									}
									// 2. Put the arrowhead on the correct side
									markerEnd={
										isFromCenter ? `url(#arrowhead-${rel.typeId})` : undefined
									}
									markerStart={
										!isFromCenter ? `url(#arrowhead-${rel.typeId})` : undefined
									}
									opacity={isActive ? 1 : edgeOpacity}
									className="pointer-events-none transition-opacity duration-300"
								/>
							</g>
						);
					},
				)}

				{relatedCharacters.map((char, i: number) => {
					const angle =
						(i / relatedCharacters.length) * 2 * Math.PI - Math.PI / 2;
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
							}}
							onClick={(e) => {
								e.preventDefault();
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
								className="fill-foreground text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none"
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
		handleMouseEnterTooltip,
		setSelectedCharId,
		tooltipSide,
		types.find,
		centerRadius,
	]);
	return (
		<div className="grid grid-cols-1 grid-rows-1 w-full h-full overflow-hidden relative bg-transparent">
			{/* LAYER 1: THE GRAPH (Anchored to Right edge of Screen) */}
			<div className="col-start-1 row-start-1 w-full h-full pointer-events-auto z-0">
				<div
					className={cn(
						"absolute top-0 right-0 h-full w-screen touch-none select-none z-0",
						isDragging ? "cursor-grabbing" : "cursor-grab",
					)}
					onWheel={handleWheel}
					onPointerDown={(e) => {
						if (isModalOpen) return;
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
						<defs>
							{types.map((t) => (
								<Fragment key={t.id}>
									{/* 1. Sleek Chevron Arrowhead */}
									<marker
										id={`arrowhead-${t.id}`}
										viewBox="0 0 10 10"
										refX="6"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path d="M 0 1 L 8 5 L 0 9 L 2.5 5 Z" fill={t.color} />
									</marker>

									{/* 2. Gradient: Fades from Center -> Outwards */}
									<linearGradient
										id={`grad-out-${t.id}`}
										x1="0%"
										y1="0%"
										x2="100%"
										y2="0%"
									>
										<stop offset="0%" stopColor={t.color} stopOpacity="0.05" />
										<stop offset="100%" stopColor={t.color} stopOpacity="1" />
									</linearGradient>

									{/* 3. Gradient: Fades from Outwards -> Center */}
									<linearGradient
										id={`grad-in-${t.id}`}
										x1="0%"
										y1="0%"
										x2="100%"
										y2="0%"
									>
										<stop offset="0%" stopColor={t.color} stopOpacity="1" />
										<stop
											offset="100%"
											stopColor={t.color}
											stopOpacity="0.05"
										/>
									</linearGradient>
								</Fragment>
							))}
						</defs>
						{graphSvgContent}
					</svg>
				</div>
				{/* LAYER 2: THE FOREGROUND UI (Stays strictly within SidebarInset bounds) */}
				<div className="col-start-1 row-start-1 z-10 w-full h-full flex flex-col justify-between pointer-events-none">
					{/* Header */}
					<header className="w-full p-6 flex items-center justify-between shrink-0 pointer-events-none ">
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
							onClick={(e) => {
								e.stopPropagation();
								setEditingRel(null); // Null means it's a NEW relation
								setIsModalOpen(true);
							}}
							className="px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-full flex items-center gap-2 pointer-events-auto z-40"
						>
							<Plus className="w-4 h-4" /> New Relation
						</Button>
					</header>

					{/* Legend Container */}
					<div className="h-full w-min p-6 flex flex-col flex-wrap-reverse justify-start items-start gap-3 pointer-events-none self-end">
						{types.map((type) => (
							<Badge
								variant={"secondary"}
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
				{/* Modals */}
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
