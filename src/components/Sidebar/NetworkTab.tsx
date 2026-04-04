import { useGraphStore } from "@/store/useGraphStore";

export default function NetworkTab() {
	const relationshipTypes = useGraphStore((state) => state.relationshipTypes);

	return (
		<div className="h-full px-4">
			<h2 className="text-xs font-mono uppercase tracking-widest opacity-50 mb-4">
				Network View
			</h2>
			<p className="text-xs opacity-40 leading-relaxed">
				Viewing the full relationship network. All characters and their
				connections are displayed as an interactive graph.
			</p>
			<div className="mt-4 space-y-2 text-[10px] opacity-30">
				<p>Drag nodes to reposition</p>
				<p>Double-click a node to select that character</p>
				<p>Scroll to zoom</p>
				<p>Drag background to pan</p>
			</div>
			<div className="mt-6 space-y-2">
				<h3 className="text-[10px] font-mono uppercase tracking-widest opacity-40">
					Legend
				</h3>
				{relationshipTypes.map((type) => (
					<div key={type.id} className="flex items-center gap-2">
						<div
							className="w-2 h-2 rounded-full"
							style={{ backgroundColor: type.color }}
						/>
						<span className="text-[10px] opacity-50">{type.label}</span>
					</div>
				))}
			</div>
		</div>
	);
}
