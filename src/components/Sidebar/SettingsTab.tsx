import type { Session } from "@supabase/supabase-js";
import { Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getDesktopApi } from "@/lib/desktop";
import { supabase } from "@/lib/supabase";
import { useGraphStore } from "@/store/useGraphStore";
import ThemeManager from "./ThemeManager";

export default function SettingsTab() {
	const importData = useGraphStore((state) => state.importData);
	const allCharacters = useGraphStore((state) => state.characters);
	const relationshipTypes = useGraphStore((state) => state.relationshipTypes);
	const relationships = useGraphStore((state) => state.relationships);
	const groups = useGraphStore((state) => state.groups);
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data }) => setSession(data.session));
		supabase.auth.onAuthStateChange((_e, s) => setSession(s));
	}, []);

	const exportData = async () => {
		const data = {
			version: "1.0.0",
			characters: allCharacters,
			relationshipTypes: relationshipTypes,
			relationships: relationships,
			groups: groups,
		};
		const contents = JSON.stringify(data, null, 2);
		const defaultPath = `charel-export-${new Date().toISOString().split("T")[0]}.json`;

		try {
			const desktop = getDesktopApi();

			if (desktop) {
				const filePath = await desktop.dialog.saveFile({
					filters: [
						{
							name: "JSON Data",
							extensions: ["json"],
						},
					],
					defaultPath,
				});

				if (filePath) {
					await desktop.fs.writeTextFile(filePath, contents);
					alert("Data exported successfully!");
				}
				return;
			}

			const url = URL.createObjectURL(
				new Blob([contents], { type: "application/json" }),
			);
			const link = document.createElement("a");
			link.href = url;
			link.download = defaultPath;
			link.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Export failed:", error);
			alert("Failed to export data.");
		}
	};

	return (
		<div className="h-full">
			<ThemeManager />

			<Separator />
			<div className="p-2 min-h-9 flex items-center justify-between">
				<div>
					<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
						Data Management
					</h2>
				</div>
				<div className="flex gap-2">
					<Button
						variant={"ghost"}
						disabled={!!session}
						title={session ? "Disabled when Online" : undefined}
						onClick={() => {
							const input = document.createElement("input");
							input.type = "file";
							input.accept = ".json";
							input.onchange = (e) => {
								if (!e?.target) return;
								const files = (e.target as HTMLInputElement).files;
								if (!files || files.length === 0) return;
								const file = files[0];
								const reader = new FileReader();
								reader.onload = (re) => {
									try {
										const json = JSON.parse(re.target?.result as string);
										importData(json);
										alert("Data imported successfully!");
									} catch (err) {
										console.error(err);
										alert("Invalid JSON file");
									}
								};
								reader.readAsText(file);
							};
							input.click();
						}}
						className="p-1 hover:bg-white/10 rounded text-[10px] uppercase font-bold flex items-center gap-1"
					>
						<Plus className="w-3 h-3" /> Import
					</Button>
					<Button
						variant={"ghost"}
						onClick={() => void exportData()}
						className="p-1 hover:bg-white/10 rounded text-[10px] uppercase font-bold flex items-center gap-1"
					>
						<Download className="w-3 h-3" /> Export
					</Button>
				</div>
			</div>
			<div className="p-2 max-h-9/12 relative group">
				<Textarea
					value={JSON.stringify(
						{
							version: "2",
							characters: allCharacters.map((c) => {
								return {
									...c,
									avatar: c.avatar?.startsWith("data:image/webp;base64")
										? "data:image/webp;base64..."
										: c.avatar,
								};
							}),
							relationshipTypes: relationshipTypes,
							relationships: relationships,
							groups: groups,
						},
						null,
						2,
					)}
					disabled
					className="size-full max-h-96 p-3 resize-none! font-mono text-[10px] focus:outline-none! no-scrollbar"
				/>
				<p className="text-[10px] opacity-40 italic my-2">
					Displayed text is shortened, use export button to get full json file.
				</p>
			</div>
		</div>
	);
}
