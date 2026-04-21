import { Shield } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const BOOT_STEPS = [
	{ id: "SYS_01", text: "INITIALIZING SECURE ENCLAVE", delay: 0 },
	{ id: "SYS_02", text: "VERIFYING KERNEL INTEGRITY", delay: 800 },
	{ id: "NET_01", text: "ESTABLISHING ENCRYPTED SOCKETS", delay: 1800 },
	{ id: "AUTH_01", text: "AUTHENTICATING LOCAL NODE", delay: 3000 },
	{ id: "DB_01", text: "MOUNTING GRAPH DATABASE", delay: 4200 },
	{ id: "SYS_03", text: "WORKSPACE READY", delay: 5500 },
];

export default function LoadingScreen() {
	const shouldReduceMotion = useReducedMotion();
	const [activeSteps, setActiveSteps] = useState<number>(0);

	useEffect(() => {
		if (shouldReduceMotion) {
			setActiveSteps(BOOT_STEPS.length);
			return;
		}

		const timeouts = BOOT_STEPS.map((step, index) =>
			setTimeout(() => setActiveSteps(index + 1), step.delay),
		);

		return () => {
			for (const t of timeouts) {
				clearTimeout(t);
			}
		};
	}, [shouldReduceMotion]);

	return (
		<motion.div
			initial={{ opacity: 1 }}
			exit={{ opacity: 0, scale: 1.02 }}
			transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
			className="fixed inset-0 z-[1000] bg-background text-foreground overflow-y-auto overflow-x-hidden md:overflow-hidden flex flex-col md:flex-row font-sans selection:bg-primary/30"
		>
			{/* LEFT AREA: Dramatic, Asymmetric Brand Presence */}
			<div className="relative flex-1 min-h-[400px] md:min-h-0 flex flex-col justify-between p-6 md:p-12 lg:p-16 bg-primary text-primary-foreground overflow-hidden">
				{/* Background Noise/Grid */}
				<div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none mix-blend-overlay" />

				<header className="relative z-10 flex items-start justify-between">
					<div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center mix-blend-screen drop-shadow-xl">
						<img
							src={logoUrl}
							alt="Charel Logo"
							className="w-full h-full object-contain"
						/>
					</div>
					<div className="text-right">
						<p className="text-[10px] md:text-xs font-mono font-bold tracking-[0.2em] uppercase opacity-80">
							Node: CH-01
						</p>
						<p className="text-[8px] md:text-[10px] font-mono uppercase tracking-[0.3em] opacity-60 mt-1">
							Status: Encrypted
						</p>
					</div>
				</header>

				{/* Massive Typography breaking the grid */}
				<motion.div
					initial={{ x: -100, opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
					className="relative z-10 mt-auto mb-8 md:mb-16"
				>
					<h1 className="text-[clamp(4rem,12vw,12rem)] leading-[0.85] font-black tracking-tighter uppercase -ml-1 md:-ml-4 opacity-90 mix-blend-overlay">
						Charel
						<br />
						Secure
					</h1>
				</motion.div>

				<footer className="relative z-10 flex gap-8 md:gap-12 font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-70">
					<div className="flex flex-col gap-1">
						<span className="opacity-50">Protocol</span>
						<span className="font-bold">E2E-AES256</span>
					</div>
					<div className="flex flex-col gap-1">
						<span className="opacity-50">Access</span>
						<span className="font-bold">Strict</span>
					</div>
					<div className="flex flex-col gap-1 hidden sm:flex">
						<span className="opacity-50">Build</span>
						<span className="font-bold">v2.1.1</span>
					</div>
				</footer>
			</div>

			{/* RIGHT AREA: Technical Diagnostic Terminal */}
			<div className="w-full md:w-[400px] lg:w-[500px] flex-shrink-0 flex flex-col bg-background relative z-20 border-t md:border-t-0 md:border-l border-border shadow-[0_-20px_40px_rgba(0,0,0,0.1)] md:shadow-[-20px_0_40px_rgba(0,0,0,0.1)]">
				<div className="flex-1 p-6 md:p-10 lg:p-16 flex flex-col justify-center">
					<div className="mb-10 lg:mb-16">
						<Shield
							className="w-10 h-10 lg:w-12 lg:h-12 text-primary mb-6 lg:mb-8"
							strokeWidth={1}
						/>
						<h2 className="text-2xl lg:text-3xl font-bold tracking-tighter mb-2 lg:mb-3 uppercase">
							System Boot
						</h2>
						<p className="text-[10px] lg:text-xs text-muted-foreground font-mono tracking-wider uppercase">
							Initializing Local Workspace...
						</p>
					</div>

					{/* Console Output */}
					<div className="space-y-4 lg:space-y-6 font-mono text-[10px] lg:text-[11px] uppercase tracking-widest flex-1">
						{BOOT_STEPS.map((step, index) => {
							const isActive = index < activeSteps;
							const isCurrent = index === activeSteps - 1;

							return (
								<div
									key={step.id}
									className={cn(
										"flex gap-3 md:gap-4 transition-all duration-500",
										isActive ? "opacity-100" : "opacity-0 translate-y-4",
									)}
								>
									<span className="text-muted-foreground/50 w-14 md:w-16 flex-shrink-0">
										[{step.id}]
									</span>
									<span
										className={cn(
											"flex-1",
											isCurrent
												? "text-foreground font-bold"
												: "text-muted-foreground",
										)}
									>
										{step.text}
									</span>
									<span
										className={cn(
											"w-6 md:w-8 text-right font-bold transition-opacity duration-300",
											isActive && !isCurrent
												? "text-primary opacity-100"
												: "opacity-0",
										)}
									>
										OK
									</span>
								</div>
							);
						})}
					</div>

					{/* Progress Bar */}
					<div className="mt-8 lg:mt-12 pt-6 lg:pt-8 border-t border-border/50">
						<div className="flex justify-between font-mono text-[8px] lg:text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 lg:mb-4">
							<span>Sequence Progress</span>
							<span className="text-foreground font-bold">
								{Math.round((activeSteps / BOOT_STEPS.length) * 100)}%
							</span>
						</div>
						<div className="h-[2px] w-full bg-secondary overflow-hidden">
							<motion.div
								className="h-full bg-primary"
								initial={{ width: "0%" }}
								animate={{
									width: `${(activeSteps / BOOT_STEPS.length) * 100}%`,
								}}
								transition={{ duration: 0.5, ease: "easeOut" }}
							/>
						</div>
					</div>
				</div>
			</div>
		</motion.div>
	);
}
