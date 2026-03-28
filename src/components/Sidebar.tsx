import { Edit2, FileJson, Plus, Settings, Trash2, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import { useGraphStore } from "#/store/useGraphStore";
import CharacterModal from "./CharacterModal";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

export default function Sidebar() {
	const importData = useGraphStore((state) => state.importData);
	const allChars = useGraphStore((state) => state.characters);
	const types = useGraphStore((state) => state.types);
	const relationships = useGraphStore((state) => state.relationships);

	const selectedId = useGraphStore((state) => state.selectedCharId);

	const setSelectedCharId = useGraphStore((state) => state.setSelectedCharId);

	const addCharacter = useGraphStore((state) => state.addCharacter);

	const updateCharacter = useGraphStore((state) => state.updateCharacter);

	const deleteCharacter = useGraphStore((state) => state.deleteCharacter);

	const deleteType = useGraphStore((state) => state.deleteType);

	return (
		<>
			<div className="bg-[#141414] border-r border-white/10 relative flex flex-col overflow-hidden">
				<div className="w-80 h-full flex items-center justify-between border-bottom border-white/10">
					<Tabs defaultValue="characters" className="size-full flex gap-1">
						<div className="p-4 flex justify-between">
							<h1 className="text-xl font-bold tracking-tighter flex items-center gap-2 italic serif">
								<Users className="w-5 h-5" />
								SEK REL MGR
							</h1>
							<TabsList>
								<TabsTrigger value="characters">
									<Users className="w-4 h-4" />
								</TabsTrigger>
								<TabsTrigger value="types">
									<Settings className="w-4 h-4" />
								</TabsTrigger>
								<TabsTrigger value="json">
									<FileJson className="w-4 h-4" />
								</TabsTrigger>
							</TabsList>
						</div>
						<TabsContent
							className="flex-1 overflow-y-auto p-4 custom-scrollbar"
							value="characters"
						>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
										Characters
									</h2>
									<CharacterModal
										char={{
											id: "",
											name: "",
											description: "",
											avatar: "",
										}}
										onSave={addCharacter}
									/>
								</div>
								<div className="space-y-2">
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
											<Avatar size="lg">
												<AvatarImage src={char.avatar} />
												<AvatarFallback>{char.name}</AvatarFallback>
											</Avatar>

											<div className="flex-1 min-w-0">
												<h3 className="font-medium truncate">{char.name}</h3>
												<p className="text-xs opacity-50 truncate">
													{char.description}
												</p>
											</div>
											<div className="opacity-0 group-hover:opacity-100 flex flex-col">
												<CharacterModal
													char={{
														id: "1",
														name: "",
														description: "",
														avatar: "",
													}}
													onSave={updateCharacter}
												></CharacterModal>
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
							</div>
						</TabsContent>
						<TabsContent
							className="flex-1 overflow-y-auto p-4 custom-scrollbar"
							value="types"
						>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
										Link Types
									</h2>
									<button
										// onClick={() =>
										// 	setEditingType({
										// 		id: "",
										// 		label: "",
										// 		color: "#ffffff",
										// 		description: "",
										// 	})
										// }
										className="p-1 hover:bg-white/10 rounded"
									>
										<Plus className="w-4 h-4" />
									</button>
								</div>
								<div className="space-y-2">
									{types.map((type) => (
										<div
											key={type.id}
											className="group p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3"
										>
											<div
												className="w-3 h-3 rounded-full"
												style={{ backgroundColor: type.color }}
											/>
											<div className="flex-1">
												<h3 className="text-sm font-medium">{type.label}</h3>
												<p className="text-[10px] opacity-50">
													{type.description}
												</p>
											</div>
											<div className="opacity-0 group-hover:opacity-100 flex gap-1">
												<button
													// onClick={() => setEditingType(type)}
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
							</div>
						</TabsContent>
						<TabsContent
							className="h-full flex-1 overflow-y-auto p-4 custom-scrollbar"
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
											<Plus className="w-3 h-3" /> Import File
										</button>
									</div>
								</div>
								<div className="h-9/12 relative group">
									<textarea
										value={JSON.stringify(
											{ allChars, types, relationships },
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
										Tip: You can directly edit the JSON above or paste new data
										to update the graph instantly.
									</s>
									Disabled for zustand migration
								</p>
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</div>

			{/* Toggle Sidebar Button */}
			{/* <button
				onClick={() => setSidebarOpen(!sidebarOpen)}
				className="absolute left-80 top-1/2 -translate-y-1/2 z-50 p-1 bg-[#141414] border border-white/10 rounded-r-lg hover:bg-white/5 transition-all"
				style={{ left: sidebarOpen ? 320 : 0 }}
			>
				{sidebarOpen ? (
					<ChevronLeft className="w-4 h-4" />
				) : (
					<ChevronRight className="w-4 h-4" />
				)}
			</button> */}
		</>
	);
}
