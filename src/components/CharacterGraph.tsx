import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Character, Relationship, RelationshipType } from "@/types";
import ConfirmModal from "./ConfirmModal";
import RelationshipModal from "./RelationshipModal";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface CharacterGraphProps {
	centerChar: Character;
	relatedChars: Character[];
	allChars: Character[];
	relationships: Relationship[];
	types: RelationshipType[];
	onSelect: (id: string) => void;
	onDeleteRel: (fromId: string, toId: string, typeId: string) => void;
	onEditRel: (oldRel: Relationship, newRel: Relationship) => void;
}

export default function CharacterGraph({
	centerChar,
	relatedChars,
	allChars,
	relationships,
	types,
	onSelect,
	onDeleteRel,
	onEditRel,
}: CharacterGraphProps) {
	const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);

	// Minimal radius to prevent touching: (count * diameter) / (2 * PI)
	// Diameter is ~85 (42 radius * 2 + small gap)
	const minRadiusForNoTouch = (relatedChars.length * 85) / (2 * Math.PI);
	const radius = Math.max(220, Math.ceil(minRadiusForNoTouch));

	const margin = 100; // Tighter margin for names and labels
	const centerX = radius + margin;
	const centerY = radius + margin;
	const centerRadius = 60;
	const relatedRadius = 40;
	const svgSize = (radius + margin) * 2;

	const relationshipData = useMemo(() => {
		return relatedChars.flatMap((char, i: number) => {
			const angle = (i / relatedChars.length) * 2 * Math.PI;
			const x = centerX + radius * Math.cos(angle);
			const y = centerY + radius * Math.sin(angle);

			const rels = relationships.filter(
				(r) =>
					(r.fromId === centerChar.id && r.toId === char.id) ||
					(r.fromId === char.id && r.toId === centerChar.id),
			);

			return rels.map((rel, idx: number) => {
				const isFromCenter = rel.fromId === centerChar.id;
				const type = types.find((t) => t.id === rel.typeId);
				const offset = (idx - (rels.length - 1) / 2) * 30;

				const startX = isFromCenter ? centerX : x;
				const startY = isFromCenter ? centerY : y;
				const endX = isFromCenter ? x : centerX;
				const endY = isFromCenter ? y : centerY;
				const targetRadius = isFromCenter ? relatedRadius : centerRadius;
				const sourceRadius = isFromCenter ? centerRadius : relatedRadius;

				// Midpoint and normal for curve - ALWAYS calculate from center to outer for consistency
				const midX = (startX + endX) / 2;
				const midY = (startY + endY) / 2;
				const vdx = x - centerX;
				const vdy = y - centerY;
				const vdist = Math.sqrt(vdx * vdx + vdy * vdy);
				const vnx = -vdy / vdist;
				const vny = vdx / vdist;

				const cpX = midX + vnx * offset;
				const cpY = midY + vny * offset;

				// Adjust endpoints to circle edges
				const distToCPStart = Math.sqrt(
					(cpX - startX) ** 2 + (cpY - startY) ** 2,
				);
				const adjStartX =
					startX + (cpX - startX) * (sourceRadius / distToCPStart);
				const adjStartY =
					startY + (cpY - startY) * (sourceRadius / distToCPStart);

				const distToCPEnd = Math.sqrt((cpX - endX) ** 2 + (cpY - endY) ** 2);
				// We stop slightly before the circle to let the arrowhead sit on the edge
				const adjEndX =
					endX + (cpX - endX) * ((targetRadius + 2) / distToCPEnd);
				const adjEndY =
					endY + (cpY - endY) * ((targetRadius + 2) / distToCPEnd);

				const path = `M ${adjStartX} ${adjStartY} Q ${cpX} ${cpY} ${adjEndX} ${adjEndY}`;

				return { rel, type, path, cpX, cpY };
			});
		});
	}, [
		centerChar,
		relatedChars,
		relationships,
		types,
		centerX,
		centerY,
		radius,
	]);

	return (
		<div className="w-full h-full p-8 flex items-center justify-center">
			<svg
				className="w-full h-full max-w-full max-h-full overflow-visible"
				viewBox={`0 0 ${svgSize} ${svgSize}`}
				preserveAspectRatio="xMidYMid meet"
			>
				<defs>
					{types.map((t) => (
						<marker
							key={t.id}
							id={`arrowhead-${t.id}`}
							markerWidth="10"
							markerHeight="7"
							refX="10"
							refY="3.5"
							orient="auto"
						>
							<polygon points="0 0, 10 3.5, 0 7" fill={t.color} />
						</marker>
					))}
				</defs>

				{/* Related Characters */}
				{relatedChars.map((char, i: number) => {
					const angle = (i / relatedChars.length) * 2 * Math.PI;
					const x = centerX + radius * Math.cos(angle);
					const y = centerY + radius * Math.sin(angle);

					// Position name radially outside the circle
					const textRadius = radius + 65;
					const textX = centerX + textRadius * Math.cos(angle);
					const textY = centerY + textRadius * Math.sin(angle);

					return (
						<g
							key={char.id}
							onClick={() => onSelect(char.id)}
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
								width="80"
								height="80"
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

				{/* Center Character */}
				<g className="drop-shadow-2xl">
					<circle
						cx={centerX}
						cy={centerY}
						r="62"
						fill="#0a0a0a"
						stroke="white"
						strokeWidth="2"
					/>
					<clipPath id="clip-center">
						<circle cx={centerX} cy={centerY} r="60" />
					</clipPath>
					<image
						href={
							centerChar.avatar ||
							`https://picsum.photos/seed/${centerChar.id}/120/120`
						}
						x={centerX - 60}
						y={centerY - 60}
						width="120"
						height="120"
						clipPath="url(#clip-center)"
						// @ts-expect-error: referrerPolicy is valid on SVGImageElement but missing in React types
						referrerPolicy="no-referrer"
					/>
				</g>

				{/* Relationship Paths (Arrows) */}
				{relationshipData.map(({ rel, type, path }) => {
					const relId = `${rel.fromId}-${rel.toId}-${rel.typeId}`;
					return (
						<g key={`rel-path-${relId}`} className="cursor-help">
							{/* Visible path */}
							<path
								d={path}
								fill="none"
								stroke={type?.color || "#fff"}
								strokeWidth="2"
								markerEnd={`url(#arrowhead-${rel.typeId})`}
								className={cn(
									"transition-opacity pointer-events-none",
									hoveredRelId === relId ? "opacity-100" : "opacity-40",
								)}
							/>
							<Tooltip>
								<TooltipTrigger asChild>
									{/* Invisible thicker path for easier hovering/right-clicking */}
									<path
										d={path}
										fill="none"
										stroke="transparent"
										strokeWidth="6"
										className="pointer-events-auto"
										onContextMenu={(e) => {
											e.preventDefault();
											onDeleteRel(rel.fromId, rel.toId, rel.typeId);
										}}
									/>
								</TooltipTrigger>
								<TooltipContent>
									<div className="h-full max-h-75 w-45 flex flex-col items-center justify-center">
										<span className="leading-tight">
											{rel.description || type?.label}
										</span>
										<div className="w-full mt-2 flex gap-2 justify-between">
											<RelationshipModal
												fromId={rel.fromId}
												initialData={rel}
												characters={allChars}
												types={types}
												onSave={(newRel: Relationship) =>
													onEditRel(rel, newRel)
												}
											>
												<Button>Edit</Button>
											</RelationshipModal>

											<ConfirmModal
												title="Delete Relationship"
												message={`Are you sure you want to delete this relationship?`}
												onConfirm={() => {
													onDeleteRel(rel.fromId, rel.toId, rel.typeId);
												}}
											/>
										</div>
										<p className="mt-1 text-[12px] opacity-40 italic">
											Right-click line to delete
										</p>
									</div>
								</TooltipContent>
							</Tooltip>
						</g>
					);
				})}
			</svg>
		</div>
	);
}
