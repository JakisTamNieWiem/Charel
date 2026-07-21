import {
	ArrowDownLeft,
	ArrowUpRight,
	Edit2,
	History as HistoryIcon,
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
import RelationshipDescriptionText from "@/components/RelationshipDescriptionText";
import RelationshipHistoryDialog from "@/components/RelationshipHistoryDialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthProvider";
import {
	useMarkRelationshipVersionsRead,
	useUnreadRelationshipVersions,
} from "@/hooks/useRelationshipVersions";
import { useSvgPanZoom } from "@/hooks/useSvgPanZoom";
import { isSameRelationship } from "@/lib/realtime-graph";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Relationship } from "@/types/types";
import ConfirmModal from "./ConfirmModal";
import RelationshipModal from "./RelationshipModal";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function getRelationshipKey(rel: Relationship) {
	return rel.id ?? `${rel.fromId}-${rel.toId}-${rel.typeId}`;
}

const RELATIONSHIP_HOVER_READ_DELAY = 700;

export default function CharacterGraph() {
	const { session } = useAuth();
	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);

	const allChars = useGraphStore((state) => state.characters);
	const relationships = useGraphStore((state) => state.relationships);
	const types = useGraphStore((state) => state.relationshipTypes);
	const showRelationshipTypeLegend = useGraphStore(
		(state) => state.showRelationshipTypeLegend,
	);
	const addRelationship = useGraphStore((state) => state.addRelationship);
	const updateRelationship = useGraphStore((state) => state.updateRelationship);
	const deleteRelationship = useGraphStore((state) => state.deleteRelationship);
	const { data: unreadRelationshipVersions = [] } =
		useUnreadRelationshipVersions();
	const { mutate: markRelationshipVersionsRead } =
		useMarkRelationshipVersionsRead();
	const unreadVersionsByRelationship = useMemo(
		() =>
			new Map(
				unreadRelationshipVersions.map((version) => [
					version.relationship_id,
					version,
				]),
			),
		[unreadRelationshipVersions],
	);
	const unreadOutgoingTargetIds = useMemo(() => {
		const targetIds = new Set<string>();
		for (const relationship of relationships) {
			if (
				relationship.fromId === selectedId &&
				relationship.id &&
				unreadVersionsByRelationship.has(relationship.id)
			) {
				targetIds.add(relationship.toId);
			}
		}
		return targetIds;
	}, [relationships, selectedId, unreadVersionsByRelationship]);

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
	const [historyRel, setHistoryRel] = useState<Relationship | null>(null);

	const [inspectedRel, setInspectedRel] = useState<Relationship | null>(null);
	const inspectedUnreadRef = useRef<{
		latestVersionId: number | null;
		relationshipId: string;
	} | null>(null);
	const hoverReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [relationSearch, setRelationSearch] = useState("");

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
	const cancelHoverRead = useCallback(() => {
		if (hoverReadTimerRef.current === null) return;
		clearTimeout(hoverReadTimerRef.current);
		hoverReadTimerRef.current = null;
	}, []);

	useEffect(() => {
		return cancelHoverRead;
	}, [cancelHoverRead]);

	const {
		groupRef,
		stageRef,
		svgRef,
		isDragging,
		isDraggingRef,
		handleWheel,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handlePointerCancel,
	} = useSvgPanZoom({
		svgSize,
		disabled: isModalOpen,
		onPanStart: () => {
			cancelHoverRead();
			setInspectedRel(null);
		},
	});

	const relationshipData = useMemo(() => {
		return relatedCharacters.flatMap((char, i: number) => {
			const angleDeg = (i / relatedCharacters.length) * 360 - 90;

			const rels = relationships.filter(
				(r) =>
					(r.fromId === selectedId && r.toId === char.id) ||
					(r.fromId === char.id && r.toId === selectedId),
			);
			const unreadIncomingRelationships = rels.filter(
				(relationship) =>
					relationship.toId === selectedId &&
					relationship.id !== undefined &&
					unreadVersionsByRelationship.has(relationship.id),
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
				const unreadIncomingIndex = unreadIncomingRelationships.indexOf(rel);
				const centerNotificationRadius = centerRadius + 2;
				const centerNotificationY =
					unreadIncomingIndex === -1
						? 0
						: (unreadIncomingIndex -
								(unreadIncomingRelationships.length - 1) / 2) *
							16;
				const centerNotificationX = Math.sqrt(
					Math.max(0, centerNotificationRadius ** 2 - centerNotificationY ** 2),
				);

				return {
					char,
					rel,
					type,
					idx,
					path,
					isFromCenter,
					angleDeg,
					strokeW,
					edgeOpacity,
					centerNotificationX,
					centerNotificationY,
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
		unreadVersionsByRelationship,
	]);

	const currentInspectedRel = useMemo(() => {
		if (!inspectedRel) return null;
		return (
			relationships.find((relationship) =>
				isSameRelationship(relationship, inspectedRel),
			) ?? inspectedRel
		);
	}, [inspectedRel, relationships]);

	const inspectedRelationshipDetails = useMemo(() => {
		if (!currentInspectedRel) return null;

		const type = types.find((t) => t.id === currentInspectedRel.typeId);
		const fromCharacter = allChars.find(
			(c) => c.id === currentInspectedRel.fromId,
		);
		const toCharacter = allChars.find((c) => c.id === currentInspectedRel.toId);
		const displayValue = currentInspectedRel.value ?? type?.value ?? 0;

		return {
			rel: currentInspectedRel,
			type,
			fromCharacter,
			toCharacter,
			displayValue,
		};
	}, [allChars, currentInspectedRel, types]);

	const inspectedUnreadVersion = currentInspectedRel?.id
		? unreadVersionsByRelationship.get(currentInspectedRel.id)
		: undefined;

	useEffect(() => {
		if (!currentInspectedRel?.id) {
			inspectedUnreadRef.current = null;
			return;
		}

		const previous = inspectedUnreadRef.current;
		const latestVersionId = inspectedUnreadVersion?.latest_version_id ?? null;
		if (
			latestVersionId !== null &&
			previous?.relationshipId === currentInspectedRel.id &&
			previous.latestVersionId !== latestVersionId
		) {
			markRelationshipVersionsRead({
				relationshipId: currentInspectedRel.id,
				latestVersionId,
			});
		}

		inspectedUnreadRef.current = {
			relationshipId: currentInspectedRel.id,
			latestVersionId,
		};
	}, [
		currentInspectedRel?.id,
		inspectedUnreadVersion?.latest_version_id,
		markRelationshipVersionsRead,
	]);

	const markRelationshipRead = useCallback(
		(relationship: Relationship) => {
			if (!relationship.id) return;
			const unreadVersion = unreadVersionsByRelationship.get(relationship.id);
			if (!unreadVersion) return;

			inspectedUnreadRef.current = {
				relationshipId: relationship.id,
				latestVersionId: unreadVersion.latest_version_id,
			};
			markRelationshipVersionsRead({
				relationshipId: relationship.id,
				latestVersionId: unreadVersion.latest_version_id,
			});
		},
		[markRelationshipVersionsRead, unreadVersionsByRelationship],
	);

	const handleMouseEnterLine = useCallback(
		(relationship: Relationship) => {
			if (isDraggingRef.current) return;
			setInspectedRel(relationship);
			cancelHoverRead();
			if (
				!relationship.id ||
				!unreadVersionsByRelationship.has(relationship.id)
			) {
				return;
			}

			hoverReadTimerRef.current = setTimeout(() => {
				markRelationshipRead(relationship);
				hoverReadTimerRef.current = null;
			}, RELATIONSHIP_HOVER_READ_DELAY);
		},
		[
			cancelHoverRead,
			isDraggingRef,
			markRelationshipRead,
			unreadVersionsByRelationship,
		],
	);

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
	const canEditSelectedCharacter =
		!session || selectedCharacter?.ownerId === session.user.id;
	const canEditInspectedRelationship =
		!session ||
		inspectedRelationshipDetails?.fromCharacter?.ownerId === session.user.id;

	const graphSvgContent = useMemo(() => {
		return (
			<g ref={groupRef} transform="translate(0, 0) scale(1)">
				<g
					key={selectedId ?? "empty-character-graph"}
					className="animate-in fade-in-0 zoom-in-95 duration-300 ease-out transform-fill origin-center will-change-[opacity,transform] motion-reduce:animate-none motion-reduce:will-change-auto"
				>
					{relationshipData.map(
						({ rel, type, idx, path, isFromCenter, angleDeg, edgeOpacity }) => {
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
										data-testid={`relationship-hover-${rel.id ?? relId}`}
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
											cancelHoverRead();
											markRelationshipRead(rel);
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
											cancelHoverRead();
											markRelationshipRead(rel);
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
								{unreadOutgoingTargetIds.has(char.id) && (
									<g
										aria-label={`${char.name} has unread relationship updates`}
										data-testid={`graph-notification-${char.id}`}
										role="status"
										className="pointer-events-none"
									>
										<circle
											className="fill-primary stroke-background"
											cx={x + relatedRadius * 0.7}
											cy={y - relatedRadius * 0.7}
											r="7"
											strokeWidth="3"
										/>
									</g>
								)}
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
						{relationshipData.map(
							({
								char,
								rel,
								isFromCenter,
								angleDeg,
								centerNotificationX,
								centerNotificationY,
							}) =>
								!isFromCenter &&
								rel.id &&
								unreadVersionsByRelationship.has(rel.id) ? (
									<g
										key={`center-notification-${rel.id}`}
										aria-label={`${char.name} changed a relationship to ${selectedCharacter?.name}`}
										data-testid={`graph-notification-relationship-${rel.id}`}
										role="status"
										className="pointer-events-none"
										transform={`rotate(${angleDeg})`}
									>
										<circle
											className="fill-primary stroke-background"
											cx={centerNotificationX}
											cy={centerNotificationY}
											r="6"
											strokeWidth="3"
										/>
									</g>
								) : null,
						)}
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

		handleMouseEnterLine,
		setSelectedCharId,
		centerRadius,
		cancelHoverRead,
		groupRef,
		markRelationshipRead,
		unreadOutgoingTargetIds,
		unreadVersionsByRelationship,
	]);
	return (
		<div className="grid grid-cols-1 grid-rows-1 w-full h-full overflow-hidden relative bg-transparent">
			{/* LAYER 1: THE GRAPH (Anchored to Right edge of Screen) */}
			<div className="col-start-1 row-start-1 w-full h-full pointer-events-auto z-0">
				<div
					ref={stageRef}
					className={cn(
						"animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-300 ease-out will-change-[opacity,transform] motion-reduce:animate-none motion-reduce:will-change-auto",
						"absolute top-0 right-0 z-0 h-full w-screen touch-none select-none",
						isDragging ? "cursor-grabbing" : "cursor-grab",
					)}
					onWheel={handleWheel}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerCancel}
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
							className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out will-change-[opacity,transform] motion-reduce:animate-none motion-reduce:will-change-auto pointer-events-auto rounded-2xl bg-background/40 p-4 backdrop-blur-md"
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

					{showRelationshipTypeLegend && (
						<ul
							aria-label="Relationship types"
							className="no-scrollbar pointer-events-none absolute top-1/2 left-0 flex max-h-[calc(100%-3rem)] w-[min(11.5rem,calc(100vw-25rem))] -translate-y-1/2 flex-col gap-1 overflow-x-clip overflow-y-auto overscroll-contain py-1 max-[640px]:hidden"
						>
							{types.map((type) => (
								<li
									key={type.id}
									className="relative min-h-6 w-full shrink-0"
									style={
										{ "--legend-color": type.color } as React.CSSProperties
									}
								>
									<div
										aria-label={`${type.label} relationship type`}
										className="group/legend pointer-events-auto absolute top-0 left-0 inline-flex h-6 max-w-[11rem] -translate-x-[calc(100%-1.5rem)] items-center gap-2 rounded-r-full border border-l-0 border-foreground/8 bg-background/90 py-1 pr-1.5 pl-2.5 text-[0.64rem] font-black uppercase leading-none tracking-[0.1em] text-foreground/80 shadow-[0_10px_28px_rgba(0,0,0,0.16)] outline-none backdrop-blur-md transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:translate-x-0 focus:translate-x-0 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
										tabIndex={0}
									>
										<span className="min-w-0 truncate">{type.label}</span>
										<span className="size-2.5 shrink-0 rounded-full bg-(--legend-color) ring-2 ring-background shadow-[0_0_12px_color-mix(in_oklch,var(--legend-color),transparent_55%)] transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover/legend:scale-110 group-focus/legend:scale-110 motion-reduce:transition-none" />
									</div>
								</li>
							))}
						</ul>
					)}

					{/* Relationship Inspector */}
					<aside
						className="pointer-events-auto absolute top-6 right-6 bottom-6 flex w-[min(20rem,calc(100vw-3rem))] animate-in flex-col gap-4 overflow-hidden rounded-xl border border-foreground/10 bg-background/92 p-4 text-foreground shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground),transparent_94%),0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur-[18px] fade-in-0 slide-in-from-right-2 duration-200 ease-out before:h-[3px] before:shrink-0 before:rounded-full before:bg-(--relationship-accent) before:shadow-[0_0_22px_color-mix(in_oklch,var(--relationship-accent),transparent_42%)] motion-reduce:animate-none motion-reduce:will-change-auto max-[920px]:top-auto max-[920px]:right-4 max-[920px]:bottom-4 max-[920px]:left-4 max-[920px]:max-h-[min(44vh,24rem)] max-[920px]:w-auto"
						style={
							{
								"--relationship-accent":
									inspectedRelationshipDetails?.type?.color ?? "var(--primary)",
							} as React.CSSProperties
						}
					>
						<Button
							disabled={!canEditSelectedCharacter}
							title={
								canEditSelectedCharacter
									? "New relationship"
									: "Only the source character owner can add relationships"
							}
							onClick={(e) => {
								e.stopPropagation();
								setEditingRel(null);
								setIsModalOpen(true);
							}}
							className="inline-flex h-[2.35rem] w-full shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/12 bg-background/88 px-[1.05rem] pl-[0.95rem] text-[0.72rem] font-black uppercase tracking-[0.12em] text-foreground/96 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground),transparent_92%),0_14px_38px_rgba(0,0,0,0.2)] backdrop-blur-md hover:border-foreground/22 hover:bg-foreground/6 hover:text-foreground"
						>
							<Plus data-icon="inline-start" /> New Relation
						</Button>

						{inspectedRelationshipDetails ? (
							<>
								<div className="flex min-w-0 shrink-0 items-center justify-between gap-4">
									<span className="text-[0.68rem] font-black uppercase leading-[1.1] tracking-[0.12em] text-foreground/52">
										Selected relation
									</span>
									<strong className="text-sm font-black leading-none text-[color-mix(in_oklch,var(--relationship-accent),var(--foreground)_16%)] tabular-nums">
										{relationValueLabel}
									</strong>
								</div>

								<div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 max-[920px]:items-center">
									<div className="grid min-w-0 justify-items-center gap-3 text-center">
										<Avatar className="size-[3.35rem] border border-[color-mix(in_oklch,var(--relationship-accent),transparent_40%)] bg-[color-mix(in_oklch,var(--background),var(--foreground)_9%)] shadow-[0_0_0_5px_color-mix(in_oklch,var(--relationship-accent),transparent_88%)]">
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
										<div className="min-w-0 max-w-full">
											<span className="text-[0.68rem] font-black uppercase leading-[1.1] tracking-[0.12em] text-foreground/52">
												From
											</span>
											<strong className="block truncate text-base font-black leading-[1.15] text-foreground/94">
												{inspectedRelationshipDetails.fromCharacter?.name ??
													"Unknown"}
											</strong>
										</div>
									</div>

									<div className="mt-[1.55rem] flex h-3 min-w-16 items-center max-[920px]:min-w-12">
										<svg
											aria-hidden="true"
											className="h-3 w-full overflow-visible"
											viewBox="0 0 64 12"
											preserveAspectRatio="none"
										>
											<line
												x1="0"
												y1="6"
												x2="64"
												y2="6"
												stroke="var(--relationship-accent)"
												strokeOpacity="0.28"
												strokeWidth="2"
												strokeLinecap="round"
											/>
											<line
												className="motion-reduce:hidden"
												x1="0"
												y1="6"
												x2="64"
												y2="6"
												stroke="var(--relationship-accent)"
												strokeWidth="3"
												strokeLinecap="round"
												strokeDasharray="14 50"
												strokeDashoffset="64"
											>
												<animate
													attributeName="stroke-dashoffset"
													from="64"
													to="-64"
													dur="1.4s"
													repeatCount="indefinite"
												/>
											</line>
										</svg>
									</div>

									<div className="grid min-w-0 justify-items-center gap-3 text-center">
										<Avatar className="size-[3.35rem] border border-[color-mix(in_oklch,var(--relationship-accent),transparent_40%)] bg-[color-mix(in_oklch,var(--background),var(--foreground)_9%)] shadow-[0_0_0_5px_color-mix(in_oklch,var(--relationship-accent),transparent_88%)]">
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
										<div className="min-w-0 max-w-full">
											<span className="text-[0.68rem] font-black uppercase leading-[1.1] tracking-[0.12em] text-foreground/52">
												To
											</span>
											<strong className="block truncate text-base font-black leading-[1.15] text-foreground/94">
												{inspectedRelationshipDetails.toCharacter?.name ??
													"Unknown"}
											</strong>
										</div>
									</div>
								</div>

								<div className="flex min-h-[4.25rem] min-w-0 shrink-0 items-center gap-3 rounded-[0.625rem] border border-foreground/8 bg-foreground/4 px-3 py-[0.7rem]">
									<div
										className="size-[2.35rem] shrink-0 rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground),transparent_84%),0_0_24px_color-mix(in_oklch,var(--relationship-accent),transparent_68%)]"
										style={{
											backgroundColor:
												inspectedRelationshipDetails.type?.color ??
												"var(--primary)",
										}}
									/>
									<div className="grid min-w-0 max-w-full justify-center gap-[0.2rem]">
										<span className="text-[0.68rem] font-black uppercase leading-[1.1] tracking-[0.12em] text-foreground/52">
											Type
										</span>
										<strong className="block truncate text-base font-black leading-[1.15] text-foreground/94">
											{inspectedRelationshipDetails.type?.label ?? "Unknown"}
										</strong>
									</div>
								</div>

								<section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.625rem] border border-foreground/8 bg-foreground/3">
									<div className="flex shrink-0 items-center gap-[0.55rem] px-3 py-[0.7rem] pb-[0.45rem] after:h-px after:flex-auto after:bg-foreground/10">
										<span className="text-[0.68rem] font-black uppercase leading-[1.1] tracking-[0.12em] text-foreground/52">
											Note
										</span>
									</div>
									<p
										className={cn(
											"m-0 min-h-0 flex-1 overflow-y-auto px-3 pb-3 text-[0.9rem] font-normal leading-[1.55] text-foreground/88 whitespace-pre-wrap wrap-anywhere [scrollbar-gutter:stable]",
											!inspectedRelationshipDetails.rel.description &&
												"flex items-center justify-center text-center italic text-foreground/54",
										)}
									>
										{inspectedRelationshipDetails.rel.description ? (
											<RelationshipDescriptionText
												text={inspectedRelationshipDetails.rel.description}
											/>
										) : (
											"No relationship note has been written yet."
										)}
									</p>
								</section>

								<div
									className={cn(
										"grid shrink-0 gap-2 pt-1",
										canEditInspectedRelationship
											? "grid-cols-3"
											: "grid-cols-1",
									)}
								>
									<Button
										size="sm"
										variant="ghost"
										className="w-full justify-center border border-foreground/9 bg-background/82"
										disabled={!session || !inspectedRelationshipDetails.rel.id}
										title={
											!session
												? "Sign in to view relationship history"
												: inspectedRelationshipDetails.rel.id
													? "View relationship history"
													: "History is unavailable for legacy offline data"
										}
										onClick={(e) => {
											e.stopPropagation();
											setHistoryRel(inspectedRelationshipDetails.rel);
										}}
									>
										<HistoryIcon data-icon="inline-start" />
										History
									</Button>
									{canEditInspectedRelationship && (
										<>
											<Button
												size="sm"
												variant="ghost"
												className="w-full justify-center border border-foreground/9 bg-background/82"
												onClick={(e) => {
													e.stopPropagation();
													setEditingRel(inspectedRelationshipDetails.rel);
													setIsModalOpen(true);
												}}
											>
												<Edit2 data-icon="inline-start" />
												Edit
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="w-full justify-center border border-foreground/9 bg-background/82"
												onClick={(e) => {
													e.stopPropagation();
													setDeletingRel(inspectedRelationshipDetails.rel);
												}}
											>
												<Trash2 data-icon="inline-start" />
												Delete
											</Button>
										</>
									)}
								</div>
							</>
						) : (
							<div className="flex min-h-0 flex-auto flex-col gap-3 pt-[0.15rem]">
								<div className="flex items-center justify-between gap-3">
									<div className="flex min-w-0 items-baseline gap-2">
										<span className="text-[0.68rem] font-black uppercase leading-[1.1] tracking-[0.12em] text-foreground/52">
											Character relations
										</span>
										<strong className="text-[0.72rem] font-black text-foreground/84 tabular-nums">
											{characterRelationshipRows.length}
										</strong>
									</div>
								</div>

								<label className="flex min-h-9 items-center gap-2 rounded-full border border-foreground/9 bg-background/92 px-3 text-foreground/54">
									<Search className="size-3.5" />
									<Input
										value={relationSearch}
										onChange={(e) => setRelationSearch(e.target.value)}
										className="h-[2.1rem] min-w-0 border-0 bg-transparent! p-0 text-[0.82rem] shadow-none focus-visible:shadow-none"
										placeholder="Search relations..."
									/>
								</label>

								<div className="flex min-h-0 flex-auto flex-col gap-2 overflow-y-auto pr-[0.2rem]">
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
													className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_3.2rem_auto] items-center gap-3 rounded-xl border border-foreground/7 bg-foreground/3 p-[0.65rem] px-[0.7rem] text-left text-foreground transition-[border-color,background,transform] duration-150 ease-out hover:border-[color-mix(in_oklch,var(--relationship-row-accent),transparent_58%)] hover:bg-[color-mix(in_oklch,var(--relationship-row-accent),transparent_91%)] active:translate-y-px max-[920px]:min-h-[3.7rem]"
													style={
														{
															"--relationship-row-accent":
																row.type?.color ?? "var(--primary)",
														} as React.CSSProperties
													}
													onClick={(e) => {
														e.stopPropagation();
														setInspectedRel(row.rel);
														markRelationshipRead(row.rel);
													}}
												>
													<Avatar className="size-[2.35rem] border border-[color-mix(in_oklch,var(--relationship-row-accent),transparent_42%)] bg-[color-mix(in_oklch,var(--background),var(--foreground)_8%)]">
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
													<div className="grid min-w-0 content-center gap-[0.28rem]">
														<div className="flex min-w-0 items-center gap-[0.35rem]">
															<strong className="inline-flex min-w-0 flex-auto items-center gap-1 overflow-hidden text-[0.88rem] font-black leading-[1.1] text-ellipsis whitespace-nowrap">
																{row.otherCharacter?.name ?? "Unknown"}
																{row.direction === "Outgoing" ? (
																	<ArrowUpRight className="size-[0.9rem] shrink-0 text-[color-mix(in_oklch,var(--relationship-row-accent),var(--foreground)_24%)] stroke-[2.5]" />
																) : (
																	<ArrowDownLeft className="size-[0.9rem] shrink-0 text-[color-mix(in_oklch,var(--relationship-row-accent),var(--foreground)_24%)] stroke-[2.5]" />
																)}
															</strong>
														</div>
														<div className="flex min-w-0 items-center justify-start gap-[0.35rem]">
															<span className="truncate text-[0.64rem] font-extrabold uppercase leading-none tracking-[0.08em] text-foreground/54">
																{row.type?.label ?? "Unknown"}
															</span>
														</div>
													</div>
													<span className="flex h-full items-center justify-end justify-self-end text-[0.72rem] font-black leading-none text-[color-mix(in_oklch,var(--relationship-row-accent),var(--foreground)_18%)] tabular-nums">
														{valueLabel}
													</span>
													{row.direction === "Outgoing" &&
														row.rel.id &&
														unreadVersionsByRelationship.has(row.rel.id) && (
															<Badge
																aria-label="Unread relationship update"
																className="col-start-4 size-[0.65rem] rounded-full bg-primary p-0 shadow-[0_0_16px_color-mix(in_oklch,var(--primary),transparent_55%)]"
															/>
														)}
												</button>
											);
										})
									) : (
										<div className="grid min-h-20 place-items-center rounded-xl border border-dashed border-foreground/10 text-center text-[0.82rem] italic text-foreground/52">
											No relations match this search.
										</div>
									)}
								</div>
							</div>
						)}
					</aside>
				</div>
				{/* Modals */}
				{selectedId && isModalOpen && (
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
						onConfirm={() => deleteRelationship(deletingRel)}
						open={!!deletingRel}
						onOpenChange={(open) => {
							if (!open) setDeletingRel(null);
						}}
					/>
				)}
				<RelationshipHistoryDialog
					fromName={
						allChars.find((character) => character.id === historyRel?.fromId)
							?.name ?? "Unknown character"
					}
					onOpenChange={(open) => {
						if (!open) setHistoryRel(null);
					}}
					open={Boolean(historyRel)}
					relationshipId={historyRel?.id}
					toName={
						allChars.find((character) => character.id === historyRel?.toId)
							?.name ?? "Unknown character"
					}
				/>
			</div>
		</div>
	);
}
