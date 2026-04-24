import {
	ArrowDownLeft,
	ArrowUpRight,
	Edit2,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function getRelationshipKey(rel: Relationship) {
	return `${rel.fromId}-${rel.toId}-${rel.typeId}`;
}

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

	const [inspectedRel, setInspectedRel] = useState<Relationship | null>(null);
	const [relationSearch, setRelationSearch] = useState("");

	const gRef = useRef<SVGGElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const panRef = useRef({ x: 0, y: 0 });
	const scaleRef = useRef(1);
	const [isDragging, setIsDragging] = useState(false);
	const isDraggingRef = useRef(false); // Sync ref for the event listener
	const svgRef = useRef<SVGSVGElement>(null); // We need a reference to the SVG element
	const dragStartRef = useRef({ x: 0, y: 0 }); // Tracks exact absolute mouse start
	const rafRef = useRef<number | null>(null); // Tracks animation frames for 60fps

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
		if (isDraggingRef.current) return;
		setInspectedRel(rel);
	}, []);

	// Directly mutate the DOM transform
	const applyTransform = useCallback(() => {
		if (gRef.current) {
			gRef.current.setAttribute(
				"transform",
				`translate(${panRef.current.x}, ${panRef.current.y}) scale(${scaleRef.current})`,
			);
		}
	}, []);

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

	const centerGraphInWorkspace = useCallback(() => {
		if (!stageRef.current) return;

		const rect = stageRef.current.getBoundingClientRect();
		if (!rect.width) return;

		const rootFontSize =
			Number.parseFloat(
				window.getComputedStyle(document.documentElement).fontSize,
			) || 16;
		const edgeInset = 1.5 * rootFontSize;
		const legendWidth = Math.min(
			11.5 * rootFontSize,
			rect.width - 25 * rootFontSize,
		);
		const inspectorWidth = Math.min(
			20 * rootFontSize,
			rect.width - 3 * rootFontSize,
		);
		const leftBound = edgeInset + Math.max(0, legendWidth);
		const rightBound = rect.width + Math.max(0, inspectorWidth);

		if (rightBound <= leftBound) {
			panRef.current = { x: 0, y: 0 };
		} else {
			const workspaceCenter = (leftBound + rightBound) / 2;
			const offsetPx = workspaceCenter - rect.width / 2 + rootFontSize * 2.5;
			const svgUnitsPerPixel = svgSize / rect.width;
			panRef.current = { x: offsetPx * svgUnitsPerPixel, y: 0 };
		}

		scaleRef.current = 1;
		applyTransform();
	}, [applyTransform, svgSize]);

	useEffect(() => {
		if (!selectedId) {
			setInspectedRel(null);
			centerGraphInWorkspace();
			return;
		}
		setInspectedRel(null);
		centerGraphInWorkspace();
	}, [centerGraphInWorkspace, selectedId]);

	useEffect(() => {
		window.addEventListener("resize", centerGraphInWorkspace);
		return () => window.removeEventListener("resize", centerGraphInWorkspace);
	}, [centerGraphInWorkspace]);

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

				return {
					rel,
					type,
					idx,
					path,
					isFromCenter,
					angleDeg,
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

	const inspectedRelationshipDetails = useMemo(() => {
		if (!inspectedRel) return null;

		const type = types.find((t) => t.id === inspectedRel.typeId);
		const fromCharacter = allChars.find((c) => c.id === inspectedRel.fromId);
		const toCharacter = allChars.find((c) => c.id === inspectedRel.toId);
		const displayValue = inspectedRel.value ?? type?.value ?? 0;

		return {
			rel: inspectedRel,
			type,
			fromCharacter,
			toCharacter,
			displayValue,
		};
	}, [allChars, inspectedRel, types]);

	const characterRelationshipRows = useMemo(() => {
		if (!selectedId) return [];

		const query = relationSearch.trim().toLowerCase();
		const occurrenceCounts = new Map<string, number>();

		return relationships
			.filter((rel) => rel.fromId === selectedId || rel.toId === selectedId)
			.map((rel) => {
				const baseKey = getRelationshipKey(rel);
				const occurrence = occurrenceCounts.get(baseKey) ?? 0;
				occurrenceCounts.set(baseKey, occurrence + 1);
				const type = types.find((t) => t.id === rel.typeId);
				const fromCharacter = allChars.find((c) => c.id === rel.fromId);
				const toCharacter = allChars.find((c) => c.id === rel.toId);
				const otherCharacter =
					rel.fromId === selectedId ? toCharacter : fromCharacter;
				const displayValue = rel.value ?? type?.value ?? 0;
				const direction = rel.fromId === selectedId ? "Outgoing" : "Incoming";

				return {
					rel,
					rowKey: `${baseKey}-${occurrence}`,
					type,
					fromCharacter,
					toCharacter,
					otherCharacter,
					displayValue,
					direction,
					searchText: [
						otherCharacter?.name,
						type?.label,
						displayValue.toFixed(2),
					]
						.filter(Boolean)
						.join(" ")
						.toLowerCase(),
				};
			})
			.filter((row) => !query || row.searchText.includes(query))
			.sort((a, b) => {
				const byName = (a.otherCharacter?.name ?? "").localeCompare(
					b.otherCharacter?.name ?? "",
				);
				if (byName !== 0) return byName;
				return (a.type?.label ?? "").localeCompare(b.type?.label ?? "");
			});
	}, [allChars, relationSearch, relationships, selectedId, types]);

	const relationValueLabel =
		inspectedRelationshipDetails?.displayValue == null
			? "+0.--"
			: inspectedRelationshipDetails.displayValue > 0
				? `+${inspectedRelationshipDetails.displayValue.toFixed(2)}`
				: inspectedRelationshipDetails.displayValue.toFixed(2);

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
				<g
					key={selectedId ?? "empty-character-graph"}
					className="character-graph-scene-transition"
				>
					{relationshipData.map(
						({
							rel,
							type,
							idx,
							path,
							isFromCenter,
							angleDeg,

							edgeOpacity,
						}) => {
							const relKey = getRelationshipKey(rel);
							const relId = `${relKey}-${idx}`;
							const isActive =
								inspectedRel && getRelationshipKey(inspectedRel) === relKey;
							return (
								<g
									key={`rel-path-${relId}`}
									className="cursor-help"
									transform={` rotate(${angleDeg})`}
								>
									{/* Invisible trigger path */}
									<path
										d={path}
										fill="none"
										stroke="transparent"
										strokeWidth="16"
										className="pointer-events-auto cursor-help"
										onMouseEnter={(e) => {
											e.preventDefault();
											handleMouseEnterLine(rel);
										}}
										onPointerDown={(e) => {
											if (e.pointerType === "mouse" && e.button === 2) return;
											e.preventDefault();
											e.stopPropagation();
											setInspectedRel(rel);
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
											setInspectedRel(rel);
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
											!isFromCenter
												? `url(#arrowhead-${rel.typeId})`
												: undefined
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
			</g>
		);
	}, [
		// 1. Data dependencies (These DO change and should trigger redraws)
		relationshipData,
		relatedCharacters,
		inspectedRel,
		selectedCharacter,
		selectedId,
		radius,

		// 2. Cached Hover Functions (Now stable thanks to useCallback)
		handleMouseEnterLine,
		setSelectedCharId,
		centerRadius,
	]);
	return (
		<div className="grid grid-cols-1 grid-rows-1 w-full h-full overflow-hidden relative bg-transparent">
			{/* LAYER 1: THE GRAPH (Anchored to Right edge of Screen) */}
			<div className="col-start-1 row-start-1 w-full h-full pointer-events-auto z-0">
				<div
					ref={stageRef}
					className={cn(
						"character-graph-stage-transition absolute top-0 right-0 h-full w-screen touch-none select-none z-0",
						isDragging ? "cursor-grabbing" : "cursor-grab",
					)}
					onWheel={handleWheel}
					onPointerDown={(e) => {
						if (isModalOpen) return;
						setIsDragging(true);
						isDraggingRef.current = true;
						setInspectedRel(null);
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
				<div className="col-start-1 row-start-1 z-10 w-full h-full pointer-events-none">
					{/* Header */}
					<header className="pointer-events-none absolute inset-x-0 top-0 flex w-full items-start p-6">
						<div
							key={selectedCharacter?.id ?? "empty-character-heading"}
							className="character-graph-header-transition bg-background/40 backdrop-blur-md p-4 rounded-2xl pointer-events-auto"
						>
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
					</header>

					<div className="relationship-type-legend pointer-events-auto">
						{types.map((type) => (
							<div
								key={type.id}
								className="relationship-type-badge"
								style={{ "--legend-color": type.color } as React.CSSProperties}
							>
								<div className="relationship-type-dot" />
								<span>{type.label}</span>
							</div>
						))}
					</div>

					{/* Relationship Inspector */}
					<aside
						className="relationship-inspector pointer-events-auto"
						style={
							{
								"--relationship-accent":
									inspectedRelationshipDetails?.type?.color ?? "var(--primary)",
							} as React.CSSProperties
						}
					>
						<Button
							onClick={(e) => {
								e.stopPropagation();
								setEditingRel(null); // Null means it's a NEW relation
								setIsModalOpen(true);
							}}
							className="relationship-inspector-new-relation"
						>
							<Plus className="size-4" /> New Relation
						</Button>

						{inspectedRelationshipDetails ? (
							<>
								<div className="relationship-inspector-topline">
									<span>Selected relation</span>
									<strong>{relationValueLabel}</strong>
								</div>

								<div className="relationship-inspector-people">
									<div className="relationship-inspector-person">
										<Avatar className="relationship-inspector-avatar">
											<AvatarImage
												src={
													inspectedRelationshipDetails.fromCharacter?.avatar ??
													undefined
												}
												alt={inspectedRelationshipDetails.fromCharacter?.name}
											/>
											<AvatarFallback>
												{inspectedRelationshipDetails.fromCharacter?.name
													.slice(0, 2)
													.toUpperCase() ?? "??"}
											</AvatarFallback>
										</Avatar>
										<div>
											<span>From</span>
											<strong>
												{inspectedRelationshipDetails.fromCharacter?.name ??
													"Unknown"}
											</strong>
										</div>
									</div>

									<div className="relationship-inspector-thread" />

									<div className="relationship-inspector-person">
										<Avatar className="relationship-inspector-avatar">
											<AvatarImage
												src={
													inspectedRelationshipDetails.toCharacter?.avatar ??
													undefined
												}
												alt={inspectedRelationshipDetails.toCharacter?.name}
											/>
											<AvatarFallback>
												{inspectedRelationshipDetails.toCharacter?.name
													.slice(0, 2)
													.toUpperCase() ?? "??"}
											</AvatarFallback>
										</Avatar>
										<div>
											<span>To</span>
											<strong>
												{inspectedRelationshipDetails.toCharacter?.name ??
													"Unknown"}
											</strong>
										</div>
									</div>
								</div>

								<div className="relationship-inspector-type">
									<div
										className="relationship-inspector-swatch"
										style={{
											backgroundColor:
												inspectedRelationshipDetails.type?.color ??
												"var(--primary)",
										}}
									/>
									<div>
										<span>Type</span>
										<strong>
											{inspectedRelationshipDetails.type?.label ?? "Unknown"}
										</strong>
									</div>
								</div>

								<p className="relationship-inspector-copy">
									{inspectedRelationshipDetails.rel.description ||
										"No relationship note has been written yet."}
								</p>

								<div className="relationship-inspector-actions">
									<Button
										size="sm"
										variant="ghost"
										onClick={(e) => {
											e.stopPropagation();
											setEditingRel(inspectedRelationshipDetails.rel);
											setIsModalOpen(true);
										}}
									>
										<Edit2 className="size-4" />
										Edit
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={(e) => {
											e.stopPropagation();
											setDeletingRel(inspectedRelationshipDetails.rel);
										}}
									>
										<Trash2 className="size-4" />
										Delete
									</Button>
								</div>
							</>
						) : (
							<div className="relationship-browser">
								<div className="relationship-browser-heading">
									<div>
										<span>Character relations</span>
										<strong>{characterRelationshipRows.length}</strong>
									</div>
								</div>

								<label className="relationship-search">
									<Search className="size-3.5" />
									<Input
										value={relationSearch}
										onChange={(e) => setRelationSearch(e.target.value)}
										className="bg-transparent!"
										placeholder="Search relations..."
									/>
								</label>

								<div className="relationship-list">
									{characterRelationshipRows.length > 0 ? (
										characterRelationshipRows.map((row) => {
											const valueLabel =
												row.displayValue > 0
													? `+${row.displayValue.toFixed(2)}`
													: row.displayValue.toFixed(2);

											return (
												<button
													type="button"
													key={row.rowKey}
													className="relationship-list-item"
													style={
														{
															"--relationship-row-accent":
																row.type?.color ?? "var(--primary)",
														} as React.CSSProperties
													}
													onClick={(e) => {
														e.stopPropagation();
														setInspectedRel(row.rel);
													}}
												>
													<Avatar className="relationship-list-avatar">
														<AvatarImage
															src={row.otherCharacter?.avatar ?? undefined}
															alt={row.otherCharacter?.name}
														/>
														<AvatarFallback>
															{row.otherCharacter?.name
																.slice(0, 2)
																.toUpperCase() ?? "??"}
														</AvatarFallback>
													</Avatar>
													<div className="relationship-list-main">
														<div className="relationship-list-title">
															<strong>
																{row.otherCharacter?.name ?? "Unknown"}
																{row.direction === "Outgoing" ? (
																	<ArrowUpRight className="relationship-list-direction" />
																) : (
																	<ArrowDownLeft className="relationship-list-direction" />
																)}
															</strong>
														</div>
														<div className="relationship-list-meta">
															<span>{row.type?.label ?? "Unknown"}</span>
														</div>
													</div>
													<span className="relationship-list-value">
														{valueLabel}
													</span>
													<div className="relationship-list-dot" />
												</button>
											);
										})
									) : (
										<div className="relationship-list-empty">
											No relations match this search.
										</div>
									)}
								</div>
							</div>
						)}
					</aside>
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
