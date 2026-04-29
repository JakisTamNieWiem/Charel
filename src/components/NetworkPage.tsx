import { Circle, Layers, LayoutGrid } from "lucide-react";
import NetworkGraph from "@/components/NetworkGraph";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGraphStore } from "@/store/useGraphStore";

export default function NetworkPage() {
	const networkMode = useGraphStore((state) => state.networkMode);
	const setNetworkMode = useGraphStore((state) => state.setNetworkMode);

	return (
		<>
			<NetworkGraph />
			<div className="absolute top-6 right-6 z-10">
				<Tabs
					value={networkMode}
					onValueChange={(value) => setNetworkMode(value)}
					orientation="vertical"
				>
					<TabsList className="bg-background/60 backdrop-blur-md border border-white/10">
						<TabsTrigger value="group" className="h-7 px-3 text-[11px]">
							<LayoutGrid className="w-3 h-3 mr-1.5" /> Group
						</TabsTrigger>
						<TabsTrigger value="groups" className="h-7 px-3 text-[11px]">
							<Layers className="w-3 h-3 mr-1.5" /> Groups
						</TabsTrigger>
						<TabsTrigger value="global" className="h-7 px-3 text-[11px]">
							<Circle className="w-3 h-3 mr-1.5" /> Global
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
		</>
	);
}
