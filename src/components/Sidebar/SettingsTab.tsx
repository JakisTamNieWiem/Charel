import type { Session } from "@supabase/supabase-js";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useGraphStore } from "@/store/useGraphStore";
import {
	SidebarPanel,
	SidebarSection,
	SidebarTabHeader,
	SidebarTabRoot,
	sidebarInputClass,
} from "./SidebarTabLayout";
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

	const handleExport = async () => {
		const data = {
			version: "1.0.0",
			characters: allCharacters,
			relationshipTypes: relationshipTypes,
			relationships: relationships,
			groups: groups,
		};

		try {
			const filePath = await save({
				filters: [
					{
						name: "JSON Data",
						extensions: ["json"],
					},
				],
				defaultPath: `charel-export-${new Date().toISOString().split("T")[0]}.json`,
			});

			if (filePath) {
				await writeTextFile(filePath, JSON.stringify(data, null, 2));
				alert("Data exported successfully!");
			}
		} catch (error) {
			console.error("Export failed:", error);
			alert("Failed to export data.");
		}
	};

	return (
		<SidebarTabRoot>
			<SidebarTabHeader title="Settings" />
			<ThemeManager />

			<Separator className="bg-(--sidebar-foreground)/10" />
			<SidebarSection
				title="Data Management"
				action={
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="xs"
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
							className="text-[0.625rem] font-bold uppercase tracking-[0.08em] hover:bg-(--sidebar-foreground)/8"
						>
							<Plus className="w-3 h-3" /> Import
						</Button>
						<Button
							variant="ghost"
							size="xs"
							onClick={() => void handleExport()}
							className="text-[0.625rem] font-bold uppercase tracking-[0.08em] hover:bg-(--sidebar-foreground)/8"
						>
							<Download className="w-3 h-3" /> Export
						</Button>
					</div>
				}
			>
				<SidebarPanel className="p-2">
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
						className={`${sidebarInputClass} size-full max-h-96 resize-none! p-3 font-mono text-[0.625rem] leading-relaxed no-scrollbar focus:outline-none!`}
					/>
					<p className="mt-2 text-[0.625rem] leading-relaxed text-muted-foreground">
						Displayed text is shortened, use export button to get full json
						file.
					</p>
				</SidebarPanel>
			</SidebarSection>
		</SidebarTabRoot>
	);
}
