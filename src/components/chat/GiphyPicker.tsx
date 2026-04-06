import { Grid } from "@giphy/react-components";
import type { IGif } from "@giphy/js-types";
import { useState } from "react";
import { gf } from "@/lib/giphy";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface GiphyPickerProps {
	onGifSelect: (gif: IGif) => void;
	width: number;
}

export default function GiphyPicker({ onGifSelect, width }: GiphyPickerProps) {
	const [search, setSearch] = useState("");

	const fetchGifs = (offset: number) => {
		if (search) {
			return gf.search(search, { offset, limit: 10 });
		}
		return gf.trending({ offset, limit: 10 });
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		e.stopPropagation();
	};

	return (
		<div
			className="flex flex-col gap-2 p-2 bg-sidebar border border-white/10 rounded-lg shadow-xl h-[400px]"
			onKeyDown={handleKeyDown}
		>
			<div className="relative shrink-0">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
				<Input
					placeholder="Search GIPHY..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="h-8 pl-7 text-xs bg-white/5 border-white/10"
					autoFocus
				/>
			</div>
			<div className="flex-1 overflow-y-auto no-scrollbar">
				<Grid
					key={search}
					width={width - 20}
					columns={2}
					fetchGifs={fetchGifs}
					onGifClick={(gif, e) => {
						e.preventDefault();
						onGifSelect(gif);
					}}
					noLink
					hideAttribution
				/>
			</div>
		</div>
	);
}
