import { Users } from "lucide-react";
import { motion } from "motion/react";

export default function LoadingScreen() {
	return (
		<motion.div
			initial={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.5, ease: "easeInOut" }}
			className="fixed inset-0 z-1000 bg-[#0a0a0a] flex flex-col items-center justify-center"
		>
			{/* Animated Logo */}
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{
					scale: [0.9, 1, 0.9],
					opacity: [0.4, 0.8, 0.4],
					filter: ["blur(0px)", "blur(2px)", "blur(0px)"],
				}}
				transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
				className="relative"
			>
				<Users className="w-16 h-16 text-white" />
				{/* Decorative scanning line effect */}
				<motion.div
					className="absolute inset-0 border-t-2 border-primary/50"
					animate={{ translateY: [0, 64, 0] }}
					transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
				/>
			</motion.div>

			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5 }}
				className="mt-8 flex flex-col items-center gap-2"
			>
				<span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
					Establishing Secure Session
				</span>
				<div className="w-48 h-px bg-white/5 overflow-hidden">
					<motion.div
						className="h-full bg-primary"
						animate={{ x: [-200, 200] }}
						transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
					/>
				</div>
			</motion.div>
		</motion.div>
	);
}
