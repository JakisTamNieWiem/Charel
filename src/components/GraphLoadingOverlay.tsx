import { GitBranch, Layers, Link2, MessageCircle, Orbit } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

type GraphLoadingOverlayProps = {
	variant: "character" | "chat" | "groups" | "link" | "network";
	subject?: string;
	nodeCount: number;
	edgeCount: number;
	typeCount: number;
	pendingCount?: number;
	groupCount?: number;
};

export default function GraphLoadingOverlay({
	variant,
	subject,
	nodeCount,
	edgeCount,
	typeCount,
	pendingCount = 0,
	groupCount = 0,
}: GraphLoadingOverlayProps) {
	const shouldReduceMotion = useReducedMotion();
	const Icon =
		variant === "groups"
			? Layers
			: variant === "network"
				? Orbit
				: variant === "link"
					? Link2
					: variant === "chat"
						? MessageCircle
						: GitBranch;
	const eyebrow =
		variant === "groups"
			? "Group View"
			: variant === "network"
				? "Network Map"
				: variant === "link"
					? "Link Preview"
					: variant === "chat"
						? "Chat Console"
						: "Relation Focus";
	const headline =
		variant === "groups"
			? "Arranging groups"
			: variant === "network"
				? "Mapping relations"
				: variant === "link"
					? "Tuning signal"
					: variant === "chat"
						? "Opening channel"
						: `Focusing ${subject ?? "character"}`;
	const stats =
		variant === "groups"
			? [`${groupCount} groups`, `${nodeCount} characters`, "0 links"]
			: variant === "link"
				? [`${edgeCount} links`, `${typeCount} types`, `${nodeCount} cast`]
				: variant === "chat"
					? [`${nodeCount} contacts`, `${pendingCount} pending`, "live thread"]
					: [`${nodeCount} nodes`, `${edgeCount} edges`, `${typeCount} types`];
	const transition = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

	return (
		<motion.div
			aria-label={headline}
			aria-live="polite"
			className="graph-loading-overlay"
			exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 1.01 }}
			initial={false}
			animate={{ opacity: 1 }}
			role="status"
			transition={transition}
		>
			<div className="graph-loading-corners" aria-hidden="true" />
			<div className="graph-loading-stage">
				<div className="graph-loading-scope" aria-hidden="true">
					<svg
						className="graph-loading-constellation"
						viewBox="0 0 240 240"
						focusable="false"
					>
						<path
							className="graph-loading-link graph-loading-link-a"
							d="M120 120 L68 74 L42 146 L106 198 L188 178 L204 88 Z"
						/>
						<path
							className="graph-loading-link graph-loading-link-b"
							d="M120 120 L42 146 M120 120 L204 88 M120 120 L106 198 M120 120 L188 178 M120 120 L68 74"
						/>
						<circle className="graph-loading-center" cx="120" cy="120" r="18" />
						<circle
							className="graph-loading-node node-a"
							cx="68"
							cy="74"
							r="7"
						/>
						<circle
							className="graph-loading-node node-b"
							cx="42"
							cy="146"
							r="6"
						/>
						<circle
							className="graph-loading-node node-c"
							cx="106"
							cy="198"
							r="8"
						/>
						<circle
							className="graph-loading-node node-d"
							cx="188"
							cy="178"
							r="7"
						/>
						<circle
							className="graph-loading-node node-e"
							cx="204"
							cy="88"
							r="6"
						/>
						<line
							className="graph-loading-sweep"
							x1="120"
							y1="120"
							x2="120"
							y2="24"
						/>
					</svg>
				</div>

				<div className="graph-loading-copy">
					<div className="graph-loading-kicker">
						<Icon className="size-4" strokeWidth={1.8} />
						<span>{eyebrow}</span>
					</div>
					<h2>{headline}</h2>
					<div className="graph-loading-stats" aria-hidden="true">
						{stats.map((stat) => (
							<span key={stat}>{stat}</span>
						))}
					</div>
					<div className="graph-loading-progress" aria-hidden="true">
						<span />
					</div>
				</div>
			</div>
		</motion.div>
	);
}
