import type { Session } from "@supabase/supabase-js";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
	Cloud,
	Download,
	Edit2,
	FileJson,
	Layers,
	Network,
	Plus,
	Settings,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import CharacterModal from "@/components/CharacterModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Character, RelationshipType } from "@/types";
import LoginModal from "./LoginModal";
import TypeModal from "./TypeModal";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";

function lerp(start: number, end: number, amt: number) {
	return (1 - amt) * start + amt * end;
}
function sentimentColor(value: number) {
	// 1. Clamp value to range [-1, 1] to prevent color overflow
	const clamped = Math.max(-1, Math.min(1, value));

	// 2. Define our anchor points (RGB values)
	const red = { r: 248, g: 113, b: 113 }; // #f87171
	const grey = { r: 128, g: 128, b: 128 }; // #808080
	const green = { r: 74, g: 222, b: 128 }; // #4ade80

	let start: typeof red;
	let end: typeof red;
	let t: number;

	if (clamped < 0) {
		// Moving from Red to Grey (clamped is -1 to 0)
		start = red;
		end = grey;
		t = 1 + clamped; // Inverts -1..0 to 0..1
	} else {
		// Moving from Grey to Green (clamped is 0 to 1)
		start = grey;
		end = green;
		t = clamped; // 0..1
	}

	const r = Math.round(lerp(start.r, end.r, t));
	const g = Math.round(lerp(start.g, end.g, t));
	const b = Math.round(lerp(start.b, end.b, t));

	return `rgb(${r}, ${g}, ${b})`;
}
export default function Sidebar() {
	const importData = useGraphStore((state) => state.importData);
	const allChars = useGraphStore((state) => state.characters);
	const addCharacter = useGraphStore((state) => state.addCharacter);
	const updateCharacter = useGraphStore((state) => state.updateCharacter);
	const deleteCharacter = useGraphStore((state) => state.deleteCharacter);
	const types = useGraphStore((state) => state.relationshipTypes);
	const relationships = useGraphStore((state) => state.relationships);
	const groups = useGraphStore((state) => state.groups);
	const addGroup = useGraphStore((state) => state.addGroup);
	const updateGroup = useGraphStore((state) => state.updateGroup);
	const deleteGroup = useGraphStore((state) => state.deleteGroup);
	const assignCharacterToGroup = useGraphStore(
		(state) => state.assignCharacterToGroup,
	);

	const selectedId = useGraphStore((state) => state.selectedCharId);
	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);
	const deleteType = useGraphStore((state) => state.deleteType);
	const setViewMode = useGraphStore((state) => state.setViewMode);

	const [editingCharacter, setEditingCharacter] = useState<
		Character | "new" | null
	>(null);
	const [editingType, setEditingType] = useState<RelationshipType | null>(null);

	const [loginModalOpen, setLoginModalOpen] = useState(false);
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data }) => setSession(data.session));
		supabase.auth.onAuthStateChange((_e, s) => setSession(s));
	}, []);

	return (
		<>
			<div className="w-80 *:bg-[#141414] border-r border-white/10 relative flex flex-col items-center border-bottom">
				<div className="w-full p-4 self-start flex items-center justify-between">
					<h1 className="text-2xl font-bold tracking-tighter flex items-center gap-2 serif">
						<Users className="w-8 h-8" />
						Charel
					</h1>
					{session ? (
						<div className="flex items-center justify-between">
							<Button
								variant="ghost"
								onClick={() => supabase.auth.signOut()}
								className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-emerald-400"
								title="Disconnect"
							>
								<Cloud className="w-3 h-3" /> Online
							</Button>
						</div>
					) : (
						<Button
							variant="ghost"
							className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest text-red-500"
							onClick={() => setLoginModalOpen(true)}
						>
							<Cloud className="w-3 h-3" /> Offline
						</Button>
					)}
				</div>
				<LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
				<Tabs defaultValue="characters" className="flex flex-col h-full w-full">
					<div className="px-3 flex w-full justify-between">
						<TabsList className="w-full shrink-0">
							<TabsTrigger
								value="characters"
								onClick={() => setViewMode("character")}
							>
								<Users className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								value="network"
								onClick={() => setViewMode("network")}
							>
								<Network className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								value="groups"
								onClick={() => setViewMode("network")}
							>
								<Layers className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								value="types"
								onClick={() => setViewMode("character")}
							>
								<Settings className="w-4 h-4" />
							</TabsTrigger>
							<TabsTrigger
								value="json"
								onClick={() => setViewMode("character")}
							>
								<FileJson className="w-4 h-4" />
							</TabsTrigger>
						</TabsList>
					</div>
					<div className="px-3 pt-2">
						<Separator />
					</div>
					<TabsContent
						className="flex-1 flex flex-col m-0 overflow-hidden"
						value="characters"
					>
						<div className="h-full">
							<div className="px-4 flex items-center justify-between">
								<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
									Characters
								</h2>
								<Button
									onClick={() => setEditingCharacter("new")}
									variant="ghost"
									className=""
								>
									<Plus className="w-4 h-4" />
								</Button>
							</div>

							<ScrollArea className="flex-1 px-4 h-full">
								<div className="space-y-2 py-4">
									{allChars.map((char) => (
										<div
											key={char.id}
											onClick={() => setSelectedCharId(char.id)}
											className={cn(
												"group px-3 py-2 rounded-lg border transition-all cursor-pointer flex items-center gap-3",
												selectedId === char.id
													? "bg-white/10 border-white/20"
													: "bg-transparent border-transparent hover:bg-white/5",
											)}
										>
											<Avatar className="size-14">
												<AvatarImage src={char.avatar ?? undefined} />
												<AvatarFallback>{char.name}</AvatarFallback>
											</Avatar>

											<div className="flex-1 min-w-0">
												<h3 className="font-medium truncate">{char.name}</h3>
												<p className="text-xs opacity-50 truncate">
													{char.description}
												</p>
											</div>

											<div className="opacity-0 group-hover:opacity-100 flex flex-col">
												<Button
													size="icon-sm"
													variant="ghost"
													className="p-1 hover:text-blue-400 hover:bg-transparent!"
													onClick={(e) => {
														e.stopPropagation();
														setEditingCharacter(char);
													}}
												>
													<Edit2 size="16px" />
												</Button>
												<Button
													size="icon-sm"
													variant="ghost"
													onClick={(e) => {
														e.stopPropagation();
														deleteCharacter(char.id);
													}}
													className="p-1 hover:text-red-400 hover:bg-transparent!"
												>
													<Trash2 className="w-3 h-3" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						</div>
					</TabsContent>
					<TabsContent
						className="flex-1 flex flex-col m-0 overflow-hidden"
						value="network"
					>
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
								{types.map((type) => (
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
					</TabsContent>
					<TabsContent
						className="flex-1 flex flex-col m-0 overflow-hidden"
						value="groups"
					>
						<div className="h-full">
							<div className="px-4 flex items-center justify-between">
								<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
									Groups
								</h2>
								<button
									onClick={() =>
										addGroup({
											name: `Group ${groups.length + 1}`,
											color: `hsl(${Math.round(Math.random() * 360)}, 70%, 50%)`,
										})
									}
									className="p-1 hover:bg-white/10 rounded"
								>
									<Plus className="w-4 h-4" />
								</button>
							</div>
							<ScrollArea className="flex-1 px-4 h-full">
								<div className="space-y-4 py-4">
									{groups.map((group) => {
										const members = allChars.filter(
											(c) => c.groupId === group.id,
										);
										const unassigned = allChars
											.filter((c) => !c.groupId || c.groupId === group.id)
											.sort((a, b) => a.name.localeCompare(b.name));
										return (
											<div
												key={group.id}
												className="rounded-lg border border-white/10 overflow-hidden"
											>
												{/* Group header */}
												<div className="p-3 bg-white/5 flex items-center gap-2">
													<input
														type="color"
														value={group.color}
														onChange={(e) =>
															updateGroup({
																id: group.id,
																color: e.target.value,
															})
														}
														className="w-4 h-4 bg-transparent border-none cursor-pointer shrink-0"
													/>
													<input
														value={group.name}
														onChange={(e) =>
															updateGroup({
																id: group.id,
																name: e.target.value,
															})
														}
														className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
													/>
													<button
														onClick={() => deleteGroup(group.id)}
														className="p-1 opacity-0 hover:opacity-100 hover:text-red-400 group-hover:opacity-50"
													>
														<Trash2 className="w-3 h-3" />
													</button>
												</div>

												{/* Members */}
												<div className="p-2 space-y-1">
													{members.map((char) => (
														<div
															key={char.id}
															className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5"
														>
															<Avatar className="size-6">
																<AvatarImage src={char.avatar ?? undefined} />
																<AvatarFallback className="text-[8px]">
																	{char.name.slice(0, 2)}
																</AvatarFallback>
															</Avatar>
															<span className="text-xs flex-1 truncate">
																{char.name}
															</span>
															<button
																onClick={() =>
																	assignCharacterToGroup(char.id, null)
																}
																className="p-0.5 opacity-30 hover:opacity-100 hover:text-red-400"
															>
																<X className="w-3 h-3" />
															</button>
														</div>
													))}

													{/* Add character dropdown */}
													<Select
														value=""
														onValueChange={(val) => {
															if (val) {
																assignCharacterToGroup(val, group.id);
															}
														}}
													>
														<SelectTrigger className="w-full mt-1 p-1.5 rounded bg-white/5 border border-dashed border-white/10 text-[10px] opacity-50 hover:opacity-80 h-auto min-h-0">
															<SelectValue placeholder="+ Add character..." />
														</SelectTrigger>
														<SelectContent>
															<SelectGroup>
																{unassigned
																	.filter((c) => c.groupId !== group.id)
																	.map((c) => (
																		<SelectItem key={c.id} value={c.id}>
																			{c.name}
																		</SelectItem>
																	))}
															</SelectGroup>
														</SelectContent>
													</Select>
												</div>
											</div>
										);
									})}

									{/* Ungrouped characters */}
									{allChars.filter((c) => !c.groupId).length > 0 && (
										<div className="rounded-lg border border-white/10 border-dashed overflow-hidden">
											<div className="p-3 bg-white/5">
												<span className="text-[10px] font-mono uppercase tracking-widest opacity-30">
													Ungrouped ({allChars.filter((c) => !c.groupId).length}
													)
												</span>
											</div>
											<div className="p-2 space-y-1">
												{allChars
													.filter((c) => !c.groupId)
													.map((char) => (
														<div
															key={char.id}
															className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5"
														>
															<Avatar className="size-6">
																<AvatarImage src={char.avatar ?? undefined} />
																<AvatarFallback className="text-[8px]">
																	{char.name.slice(0, 2)}
																</AvatarFallback>
															</Avatar>
															<span className="text-xs flex-1 truncate opacity-40">
																{char.name}
															</span>
														</div>
													))}
											</div>
										</div>
									)}
								</div>
							</ScrollArea>
						</div>
					</TabsContent>
					<TabsContent
						className="flex-1 flex flex-col m-0 overflow-hidden"
						value="types"
					>
						<div className="h-full">
							<div className="px-4 flex items-center justify-between">
								<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
									Link Types
								</h2>
								<button
									onClick={() =>
										setEditingType({
											id: "",
											label: "",
											color: "",
											description: "",
											value: 0,
										})
									}
									className="p-1 hover:bg-white/10 rounded"
								>
									<Plus className="w-4 h-4" />
								</button>
							</div>
							<ScrollArea className="flex-1 px-4 h-full">
								<div className="space-y-2 py-4 pb-8">
									{types.map((type) => (
										<div
											key={type.id}
											style={
												{ "--hover-color": type.color } as React.CSSProperties
											}
											className="group px-3 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3 transition-colors duration-200 hover:border-(--hover-color) hover:bg-(--hover-color)/10"
										>
											<div
												className="size-5 rounded-full"
												style={{ backgroundColor: type.color }}
											/>
											<div className="flex-1">
												<h3 className="text-sm font-medium">{type.label}</h3>
												<p className="text-[10px] opacity-50">
													{type.description}
												</p>
											</div>
											<div className="justify-end">
												<p
													style={{
														color: sentimentColor(type.value),
													}}
													className="text-xs text-left "
												>
													{type.value >= 0 ? "+" : ""}
													{type.value?.toFixed(2)}
												</p>
											</div>
											<div className="flex flex-col gap-1">
												<button
													onClick={() => setEditingType(type)}
													className="p-1 hover:text-blue-400"
												>
													<Edit2 className="w-3 h-3" />
												</button>
												<button
													onClick={() => deleteType(type.id)}
													className="p-1 hover:text-red-400"
												>
													<Trash2 className="w-3 h-3" />
												</button>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						</div>
					</TabsContent>
					<TabsContent
						className="h-full flex-1 overflow-y-auto px-4 custom-scrollbar"
						value="json"
					>
						<div className="h-full space-y-4">
							<div className="flex items-center justify-between">
								<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
									Data Management
								</h2>
								<div className="flex gap-2">
									<button
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
														const json = JSON.parse(
															re.target?.result as string,
														);
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
									</button>
									<button
										onClick={async () => {
											const data = {
												version: "1.0.0",
												characters: allChars,
												relationshipTypes: types,
												relationships: relationships,
												groups: groups,
											};
											try {
												// 1. Open the native "Save As" OS dialog
												const filePath = await save({
													filters: [
														{
															name: "JSON Data",
															extensions: ["json"],
														},
													],
													defaultPath: `charel-export-${new Date().toISOString().split("T")[0]}.json`,
												});

												// 2. If the user didn't click "Cancel"
												if (filePath) {
													// 3. Write the file directly to that exact path
													await writeTextFile(
														filePath,
														JSON.stringify(data, null, 2),
													);
													alert("Data exported successfully!"); // Optional: replace with a nice Toast notification
												}
											} catch (error) {
												console.error("Export failed:", error);
												alert("Failed to export data.");
											}
										}}
										className="p-1 hover:bg-white/10 rounded text-[10px] uppercase font-bold flex items-center gap-1"
									>
										<Download className="w-3 h-3" /> Export
									</button>
								</div>
							</div>
							<div className="h-9/12 relative group">
								<textarea
									value={JSON.stringify(
										{
											version: "1.0.0",
											characters: allChars,
											relationshipTypes: types,
											relationships: relationships,
											groups: groups,
										},
										null,
										2,
									)}
									disabled
									// onChange={(e) => {
									// 	try {
									// 		const parsed = JSON.parse(e.target.value);
									// 		importData(parsed);
									// 	} catch (err) {
									// 		// Allow typing even if temporarily invalid JSON
									// 		console.error(err);
									// 	}
									// }}
									className="size-full bg-black p-3 rounded-lg font-mono text-[10px] border border-white/10 resize-none custom-scrollbar focus:border-white/30 focus:outline-none"
								/>
								{/* <div className="absolute top-2 right-2 flex gap-2">
									<button
										onClick={() => {
											navigator.clipboard.writeText(
												JSON.stringify(data, null, 2),
											);
											alert("Copied to clipboard!");
										}}
										className="p-2 bg-white/10 hover:bg-white/20 rounded text-[10px] uppercase font-bold transition-colors"
									>
										Copy
									</button>
									<button
										onClick={() => {
											const blob = new Blob([JSON.stringify(data, null, 2)], {
												type: "application/json",
											});
											const url = URL.createObjectURL(blob);
											const a = document.createElement("a");
											a.href = url;
											a.download = `character-network-${new Date().toISOString().split("T")[0]}.json`;
											document.body.appendChild(a);
											a.click();
											document.body.removeChild(a);
											URL.revokeObjectURL(url);
										}}
										className="p-2 bg-white/10 hover:bg-white/20 rounded text-[10px] uppercase font-bold transition-colors flex items-center gap-1"
									>
										<Download className="w-3 h-3" /> Export
									</button>
								</div>
								*/}
							</div>
							<p className="text-[10px] opacity-40 italic">
								<s>
									Tip: You can directly edit the JSON above or paste new data to
									update the graph instantly.
								</s>
								Disabled for zustand migration
							</p>
						</div>
					</TabsContent>
				</Tabs>
			</div>
			{editingType && (
				<TypeModal
					type={editingType}
					open={!!editingType}
					onOpenChange={(open) => {
						if (!open) setEditingType(null);
					}}
				/>
			)}
			{editingCharacter && (
				<CharacterModal
					char={
						editingCharacter === "new"
							? { id: "", name: "", description: "", avatar: "", groupId: "" }
							: editingCharacter
					}
					onSave={editingCharacter === "new" ? addCharacter : updateCharacter}
					open={!!editingCharacter}
					onOpenChange={(open) => {
						if (!open) setEditingCharacter(null);
					}}
				/>
			)}
		</>
	);
}
