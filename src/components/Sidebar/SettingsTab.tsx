import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Download, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthProvider";
import { loadGraphBackup, parseGraphSnapshot } from "@/lib/storage";
import { createGraphSnapshot, useGraphStore } from "@/store/useGraphStore";
import type { GraphSnapshot } from "@/types/types";
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
	const showRelationshipTypeLegend = useGraphStore(
		(state) => state.showRelationshipTypeLegend,
	);
	const setShowRelationshipTypeLegend = useGraphStore(
		(state) => state.setShowRelationshipTypeLegend,
	);
	const syncStatus = useGraphStore((state) => state.syncStatus);
	const { session } = useAuth();
	const canRestore = !session || syncStatus === "error";

	const restoreSnapshot = (snapshot: GraphSnapshot) => {
		const history = useGraphStore.temporal.getState();
		history.pause();
		try {
			importData(snapshot);
			history.clear();
		} finally {
			history.resume();
		}
	};

	const handleExport = async () => {
		const data = createGraphSnapshot({
			characters: allCharacters,
			relationshipTypes,
			relationships,
			groups,
		});

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
				toast.success("Data exported successfully");
			}
		} catch (error) {
			console.error("Export failed:", error);
			toast.error("Failed to export data");
		}
	};

	const handleBackupRestore = async () => {
		const snapshot = await loadGraphBackup();
		if (!snapshot) {
			toast.error("No valid recovery snapshot found");
			return;
		}
		if (
			!window.confirm("Replace current graph data with the recovery snapshot?")
		) {
			return;
		}

		restoreSnapshot(snapshot);
		toast.success("Recovery snapshot restored");
	};

	return (
		<SidebarTabRoot>
			<SidebarTabHeader title="Settings" />
			<ThemeManager />

			<Separator className="bg-(--sidebar-foreground)/10" />
			<SidebarSection title="Graph Display">
				<SidebarPanel className="p-3">
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel htmlFor="relationship-type-legend">
								Relationship type legend
							</FieldLabel>
							<FieldDescription className="text-xs">
								Show relationship type labels on graphs.
							</FieldDescription>
						</FieldContent>
						<Switch
							id="relationship-type-legend"
							checked={showRelationshipTypeLegend}
							onCheckedChange={setShowRelationshipTypeLegend}
						/>
					</Field>
				</SidebarPanel>
			</SidebarSection>

			<Separator className="bg-(--sidebar-foreground)/10" />
			<SidebarSection
				title="Data Management"
				action={
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="xs"
							disabled={!canRestore}
							title={
								canRestore
									? "Restore recovery snapshot"
									: "Disabled while connected"
							}
							onClick={() => void handleBackupRestore()}
							className="text-[0.625rem] font-bold uppercase tracking-[0.08em] hover:bg-(--sidebar-foreground)/8"
						>
							<RotateCcw className="w-3 h-3" /> Restore
						</Button>
						<Button
							variant="ghost"
							size="xs"
							disabled={!canRestore}
							title={!canRestore ? "Disabled while connected" : undefined}
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
											const snapshot = parseGraphSnapshot(
												JSON.parse(re.target?.result as string),
											);
											if (!snapshot) throw new Error("Invalid graph snapshot");
											restoreSnapshot(snapshot);
											toast.success("Data imported successfully");
										} catch (err) {
											console.error(err);
											toast.error("Invalid graph data file");
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
