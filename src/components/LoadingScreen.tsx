import { DatabaseZap, Fingerprint, Network, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const BOOT_STEPS = [
	{ id: "CORE", text: "Igniting graph core", delay: 0 },
	{ id: "INDEX", text: "Indexing local entities", delay: 720 },
	{ id: "LINK", text: "Resolving relation vectors", delay: 1550 },
	{ id: "AUTH", text: "Sealing identity boundary", delay: 2600 },
	{ id: "CACHE", text: "Hydrating avatar cache", delay: 3950 },
	{ id: "READY", text: "Workspace lock released", delay: 5350 },
];

const CORE_NODES = [
	{ id: "a", cx: 106, cy: 54, r: 7 },
	{ id: "b", cx: 52, cy: 122, r: 8 },
	{ id: "c", cx: 90, cy: 206, r: 6 },
	{ id: "d", cx: 186, cy: 212, r: 8 },
	{ id: "e", cx: 226, cy: 126, r: 7 },
	{ id: "f", cx: 174, cy: 58, r: 6 },
];

const CORE_EDGES = [
	"M140 136 L106 54 L52 122 L90 206 L186 212 L226 126 L174 58 Z",
	"M140 136 L52 122 M140 136 L90 206 M140 136 L186 212 M140 136 L226 126 M140 136 L106 54 M140 136 L174 58",
];

export default function LoadingScreen() {
	const shouldReduceMotion = useReducedMotion();
	const [activeSteps, setActiveSteps] = useState<number>(0);
	const progress = Math.round((activeSteps / BOOT_STEPS.length) * 100);

	useEffect(() => {
		if (shouldReduceMotion) {
			setActiveSteps(BOOT_STEPS.length);
			return;
		}

		const timeouts = BOOT_STEPS.map((step, index) =>
			setTimeout(() => setActiveSteps(index + 1), step.delay),
		);

		return () => {
			for (const timeout of timeouts) {
				clearTimeout(timeout);
			}
		};
	}, [shouldReduceMotion]);

	const activeStep = BOOT_STEPS[Math.max(0, activeSteps - 1)] ?? BOOT_STEPS[0];
	const metrics = useMemo(
		() => [
			{ label: "Nodes", value: "CH-01" },
			{ label: "Cipher", value: "AES" },
			{ label: "Sync", value: `${progress}%` },
		],
		[progress],
	);

	return (
		<motion.div
			initial={{ opacity: 1 }}
			exit={{
				opacity: 0,
				scale: shouldReduceMotion ? 1 : 1.015,
				filter: shouldReduceMotion ? "none" : "blur(8px)",
			}}
			transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
			className="app-boot-screen"
			role="status"
			aria-label={`Loading workspace: ${activeStep.text}`}
		>
			<div className="app-boot-grid" aria-hidden="true" />
			<div className="app-boot-scan" aria-hidden="true" />
			<div className="app-boot-shell">
				<header className="app-boot-header">
					<div className="app-boot-brand">
						<img src={logoUrl} alt="Charel" />
						<div>
							<p>Charel</p>
							<span>Secure Graph Core</span>
						</div>
					</div>
					<div className="app-boot-status" aria-label="Boot progress">
						<span>{activeStep.id}</span>
						<strong>{progress}%</strong>
					</div>
				</header>

				<main className="app-boot-main">
					<section className="app-boot-copy" aria-live="polite">
						<div className="app-boot-kicker">
							<ShieldCheck className="size-4" strokeWidth={1.7} />
							<span>Encrypted Workspace</span>
						</div>
						<h1>
							Secure
							<br />
							Graph
							<br />
							Core
						</h1>
						<p>{activeStep.text}</p>

						<div
							className="app-boot-progress"
							aria-hidden="true"
							style={{ "--boot-progress": progress / 100 } as CSSProperties}
						>
							<div />
						</div>
					</section>

					<section className="app-boot-reactor" aria-hidden="true">
						<div className="app-boot-orbit orbit-one" />
						<div className="app-boot-orbit orbit-two" />
						<div className="app-boot-orbit orbit-three" />
						<svg className="app-boot-graph" viewBox="0 0 280 280">
							<path className="core-edge core-edge-shell" d={CORE_EDGES[0]} />
							<path className="core-edge core-edge-active" d={CORE_EDGES[1]} />
							<circle className="core-halo" cx="140" cy="136" r="46" />
							<circle className="core-pulse" cx="140" cy="136" r="28" />
							<foreignObject x="112" y="108" width="56" height="56">
								<div className="app-boot-logo-core">
									<img src={logoUrl} alt="" />
								</div>
							</foreignObject>
							{CORE_NODES.map((node, index) => (
								<circle
									key={node.id}
									className={`core-node core-node-${index + 1}`}
									cx={node.cx}
									cy={node.cy}
									r={node.r}
								/>
							))}
							<line className="core-sweep" x1="140" y1="136" x2="140" y2="16" />
						</svg>
					</section>

					<aside className="app-boot-console">
						<div className="app-boot-console-title">
							<DatabaseZap className="size-4" strokeWidth={1.7} />
							<span>Boot Trace</span>
						</div>
						<div className="app-boot-steps">
							{BOOT_STEPS.map((step, index) => {
								const isDone = index < activeSteps;
								const isCurrent = index === activeSteps - 1;

								return (
									<div
										key={step.id}
										className={cn(
											"app-boot-step",
											isDone && "is-done",
											isCurrent && "is-current",
										)}
									>
										<span>{step.id}</span>
										<p>{step.text}</p>
										<strong>{isDone ? "OK" : "..."}</strong>
									</div>
								);
							})}
						</div>
					</aside>
				</main>

				<footer className="app-boot-footer">
					{metrics.map((metric) => (
						<div key={metric.label}>
							<span>{metric.label}</span>
							<strong>{metric.value}</strong>
						</div>
					))}
					<div>
						<span>Mode</span>
						<strong>
							<Network className="size-3.5" strokeWidth={1.8} />
							Graph
						</strong>
					</div>
					<div>
						<span>Identity</span>
						<strong>
							<Fingerprint className="size-3.5" strokeWidth={1.8} />
							Bound
						</strong>
					</div>
				</footer>
			</div>
		</motion.div>
	);
}
