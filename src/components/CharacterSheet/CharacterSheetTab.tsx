import { Copy, FilePlus2, Pencil, ScrollText, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getResolutionById, useSheetStore } from "@/store/useSheetStore";
import { SHEET_BLOCKS } from "./sheet-registry";

export default function CharacterSheetTab() {
	const sheets = useSheetStore((state) => state.sheets);
	const activeSheetId = useSheetStore((state) => state.activeSheetId);
	const activeSheet = useSheetStore((state) => state.activeSheet);
	const mode = useSheetStore((state) => state.mode);
	const createSheet = useSheetStore((state) => state.createSheet);
	const selectSheet = useSheetStore((state) => state.selectSheet);
	const renameSheet = useSheetStore((state) => state.renameSheet);
	const duplicateSheet = useSheetStore((state) => state.duplicateSheet);
	const deleteSheet = useSheetStore((state) => state.deleteSheet);
	const setMode = useSheetStore((state) => state.setMode);
	const updateGrid = useSheetStore((state) => state.updateGrid);

	const [newSheetName, setNewSheetName] = useState("");
	const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
	const [editingSheetName, setEditingSheetName] = useState("");

	const sortedSheets = useMemo(
		() => [...sheets].sort((a, b) => a.name.localeCompare(b.name)),
		[sheets],
	);

	return (
		<div className="flex flex-col">
			<div className="sticky top-0 z-20 bg-sidebar px-2 py-3">
				<div className="flex items-center justify-between gap-2">
					<div>
						<h2 className="text-xs font-mono uppercase tracking-widest opacity-50">
							Character Sheets
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							Local-first JSON documents
						</p>
					</div>
					<Button
						size="sm"
						onClick={() => {
							createSheet(newSheetName.trim() || undefined);
							setNewSheetName("");
						}}
					>
						<FilePlus2 className="mr-2 size-4" />
						New
					</Button>
				</div>
				<div className="mt-3">
					<Input
						value={newSheetName}
						onChange={(event) => setNewSheetName(event.target.value)}
						placeholder="Optional name for new sheet"
					/>
				</div>
			</div>

			<div className="px-2 pb-2">
				<div className="rounded-xl border border-sidebar-border/80 bg-background/30 p-2">
					<div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Sheets
					</div>
					<div className="space-y-2">
						{sortedSheets.length === 0 && (
							<div className="rounded-lg border border-dashed border-sidebar-border px-3 py-4 text-sm text-muted-foreground">
								No sheets yet.
							</div>
						)}
						{sortedSheets.map((sheet) => (
							<div
								key={sheet.id}
								className={cn(
									"rounded-lg border px-3 py-2 transition-colors",
									activeSheetId === sheet.id
										? "border-primary/40 bg-primary/8"
										: "border-transparent bg-background/30 hover:border-sidebar-border hover:bg-background/45",
								)}
							>
								<div className="flex items-start justify-between gap-2">
									<div
										className="min-w-0 flex-1 cursor-pointer"
										onClick={() => selectSheet(sheet.id)}
									>
										{editingSheetId === sheet.id ? (
											<Input
												value={editingSheetName}
												onChange={(event) =>
													setEditingSheetName(event.target.value)
												}
												onBlur={() => {
													renameSheet(sheet.id, editingSheetName);
													setEditingSheetId(null);
												}}
												onKeyDown={(event) => {
													if (event.key === "Enter") {
														renameSheet(sheet.id, editingSheetName);
														setEditingSheetId(null);
													}
													if (event.key === "Escape") {
														setEditingSheetId(null);
													}
												}}
												autoFocus
											/>
										) : (
											<>
												<div className="truncate font-medium">{sheet.name}</div>
												<div className="text-[11px] text-muted-foreground">
													Updated {new Date(sheet.updatedAt).toLocaleString()}
												</div>
											</>
										)}
									</div>
									<div className="flex items-center gap-1">
										<Button
											size="icon-xs"
											variant="ghost"
											onClick={() => {
												setEditingSheetId(sheet.id);
												setEditingSheetName(sheet.name);
											}}
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											size="icon-xs"
											variant="ghost"
											onClick={() => duplicateSheet(sheet.id)}
										>
											<Copy className="size-4" />
										</Button>
										<Button
											size="icon-xs"
											variant="ghost"
											className="text-destructive hover:text-destructive"
											onClick={() => deleteSheet(sheet.id)}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="px-2">
				<Separator />
			</div>

			<div className="space-y-4 px-2 py-3">
				<div className="rounded-xl border border-sidebar-border/80 bg-background/30 p-3">
					<div className="mb-3 flex items-center justify-between gap-2">
						<div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
							Sheet Controls
						</div>
						<ScrollText className="size-4 text-muted-foreground" />
					</div>
					<Tabs
						value={mode}
						onValueChange={(value) => setMode(value as "edit" | "view")}
					>
						<TabsList className="w-full">
							<TabsTrigger value="edit" className="w-full justify-center">
								Edit
							</TabsTrigger>
							<TabsTrigger value="view" className="w-full justify-center">
								View
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<div className="mt-3 space-y-2">
						<div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
							Grid Resolution
						</div>
						<Select
							value={activeSheet?.grid.resolutionId ?? "balanced"}
							onValueChange={(value) => {
								if (!activeSheet || !value) return;
								const next = getResolutionById(value);
								updateGrid({
									columns: next.columns,
									rows: next.rows,
									cellSize: next.cellSize,
									resolutionId: next.id,
								});
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="cozy">Cozy</SelectItem>
								<SelectItem value="balanced">Balanced</SelectItem>
								<SelectItem value="dense">Dense</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="rounded-xl border border-sidebar-border/80 bg-background/30 p-3">
					<div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Block Palette
					</div>
					<div className="space-y-2">
						{SHEET_BLOCKS.map((block) => (
							<div
								key={block.type}
								draggable
								onDragStart={(event) => {
									event.dataTransfer.setData(
										"application/x-sheet-block",
										block.type,
									);
									event.dataTransfer.effectAllowed = "copy";
								}}
								className="cursor-grab rounded-lg border border-sidebar-border/80 bg-background/40 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-background/60 active:cursor-grabbing"
							>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">{block.icon}</span>
									<div className="min-w-0">
										<div className="font-medium">{block.label}</div>
										<div className="text-[11px] text-muted-foreground">
											{block.description}
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
