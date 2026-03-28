import { motion } from "motion/react";
import { useState } from "react";
import type { RelationshipType } from "@/types";

interface TypeModalProps {
	type: RelationshipType;
	onClose: () => void;
	onSave: (formData: RelationshipType) => void;
}

export default function TypeModal({ type, onClose, onSave }: TypeModalProps) {
	const [formData, setFormData] = useState(type);
	return (
		<div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				className="bg-[#141414] border border-white/10 p-8 rounded-2xl w-full max-w-md space-y-6"
			>
				<h2 className="text-2xl font-bold tracking-tighter italic serif underline underline-offset-8">
					{type.id ? "Edit Type" : "New Type"}
				</h2>
				<div className="space-y-4">
					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Label
						</label>
						<input
							value={formData.label}
							onChange={(e) =>
								setFormData({ ...formData, label: e.target.value })
							}
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
						/>
					</div>
					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Color
						</label>
						<div className="flex gap-3">
							<input
								type="color"
								value={formData.color}
								onChange={(e) =>
									setFormData({ ...formData, color: e.target.value })
								}
								className="w-12 h-12 bg-transparent border-none cursor-pointer"
							/>
							<input
								value={formData.color}
								onChange={(e) =>
									setFormData({ ...formData, color: e.target.value })
								}
								className="flex-1 bg-white/5 border border-white/10 p-3 rounded-lg focus:outline-none focus:border-white/30"
							/>
						</div>
					</div>
					<div className="space-y-1">
						<label className="text-[10px] uppercase font-mono tracking-widest opacity-50">
							Description
						</label>
						<textarea
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							className="w-full bg-white/5 border border-white/10 p-3 rounded-lg h-24 focus:outline-none focus:border-white/30"
						/>
					</div>
				</div>
				<div className="flex gap-3 pt-4">
					<button
						onClick={onClose}
						className="flex-1 p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors uppercase text-xs font-bold tracking-widest"
					>
						Cancel
					</button>
					<button
						onClick={() => onSave(formData)}
						className="flex-1 p-3 bg-white text-black rounded-lg hover:bg-white/90 transition-colors uppercase text-xs font-bold tracking-widest"
					>
						Save
					</button>
				</div>
			</motion.div>
		</div>
	);
}
