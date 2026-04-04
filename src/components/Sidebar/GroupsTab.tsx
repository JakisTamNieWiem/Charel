import { Plus, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useGraphStore } from "@/store/useGraphStore";
import { Button } from "../ui/button";

export default function GroupsTab() {
	const allCharacters = useGraphStore((state) => state.characters);

	const groups = useGraphStore((state) => state.groups);
	const addGroup = useGraphStore((state) => state.addGroup);
	const updateGroup = useGraphStore((state) => state.updateGroup);
	const deleteGroup = useGraphStore((state) => state.deleteGroup);
	const assignCharacterToGroup = useGraphStore(
		(state) => state.assignCharacterToGroup,
	);
	return (
		<div className="h-full">
			<div className="px-4  min-h-9 flex items-center justify-between">
				<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
					Groups
				</h2>
				<Button
					variant={"ghost"}
					onClick={() =>
						addGroup({
							name: `Group ${groups.length + 1}`,
							color: `hsl(${Math.round(Math.random() * 360)}, 70%, 50%)`,
						})
					}
					className="p-1 hover:bg-white/10 rounded"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>
			<ScrollArea className="flex-1 px-4 h-full">
				<div className="space-y-4 py-4">
					{groups.map((group) => {
						const members = allCharacters.filter((c) => c.groupId === group.id);
						const unassigned = allCharacters
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
												name: group.name,
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
												color: group.color,
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
												onClick={() => assignCharacterToGroup(char.id, null)}
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
					{allCharacters.filter((c) => !c.groupId).length > 0 && (
						<div className="rounded-lg border border-white/10 border-dashed overflow-hidden">
							<div className="p-3 bg-white/5">
								<span className="text-[10px] font-mono uppercase tracking-widest opacity-30">
									Ungrouped ({allCharacters.filter((c) => !c.groupId).length})
								</span>
							</div>
							<div className="p-2 space-y-1">
								{allCharacters
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
	);
}
