import { Grip, PanelRightOpen, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { evaluateSheetDocument } from "@/lib/sheet-formulas";
import { cn } from "@/lib/utils";
import { useSheetStore } from "@/store/useSheetStore";
import type {
	SheetDocument,
	SheetModule,
	SheetModuleType,
	SheetViewMode,
} from "@/types/sheets";
import { isFieldModule } from "@/types/sheets";
import { SHEET_BLOCK_MAP } from "./sheet-registry";

type InteractionState =
	| {
			type: "drag";
			moduleId: string;
			startClientX: number;
			startClientY: number;
			initialX: number;
			initialY: number;
	  }
	| {
			type: "resize";
			moduleId: string;
			startClientX: number;
			startClientY: number;
			initialW: number;
			initialH: number;
	  };

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function collides(target: SheetModule, modules: SheetModule[]) {
	return modules.some((module) => {
		if (module.id === target.id) return false;
		return !(
			target.x + target.w <= module.x ||
			module.x + module.w <= target.x ||
			target.y + target.h <= module.y ||
			module.y + module.h <= target.y
		);
	});
}

function normalizeRect(module: SheetModule, document: SheetDocument) {
	const block = SHEET_BLOCK_MAP[module.type];
	return {
		...module,
		x: clamp(module.x, 0, Math.max(0, document.grid.columns - block.minW)),
		y: clamp(module.y, 0, Math.max(0, document.grid.rows - block.minH)),
		w: clamp(module.w, block.minW, document.grid.columns),
		h: clamp(module.h, block.minH, document.grid.rows),
	};
}

function getFieldOptions(document: SheetDocument | null) {
	if (!document) return [];
	return document.modules.filter(isFieldModule).map((module) => ({
		value: module.props.fieldKey,
		label: module.props.label || module.props.fieldKey,
	}));
}

function ModuleInspector({
	module,
	document,
	mode,
}: {
	module: SheetModule | null;
	document: SheetDocument | null;
	mode: SheetViewMode;
}) {
	const updateModule = useSheetStore((state) => state.updateModule);
	const deleteModule = useSheetStore((state) => state.deleteModule);
	const fieldOptions = useMemo(() => getFieldOptions(document), [document]);

	if (!module || !document) {
		return (
			<div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
				Select a block in edit mode to configure it.
			</div>
		);
	}

	const update = (updater: (current: SheetModule) => SheetModule) =>
		updateModule(module.id, updater);
	const updateLayout = (
		patch: Partial<Pick<SheetModule, "x" | "y" | "w" | "h">>,
	) => update((current) => ({ ...current, ...patch }) as SheetModule);
	const updateProps = (patch: Record<string, unknown>) =>
		update(
			(current) =>
				({
					...current,
					props: { ...current.props, ...patch },
				}) as SheetModule,
		);

	return (
		<div className="rounded-2xl border border-border/70 bg-background/70 p-4">
			<div className="mb-4 flex items-center justify-between gap-2">
				<div>
					<div className="text-sm font-semibold">
						{SHEET_BLOCK_MAP[module.type].label}
					</div>
					<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						{mode === "edit" ? "Block Settings" : "View Details"}
					</div>
				</div>
				<Button
					size="icon-sm"
					variant="ghost"
					className="text-destructive hover:text-destructive"
					onClick={() => deleteModule(module.id)}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>

			<div className="space-y-3">
				<div className="grid grid-cols-2 gap-2">
					<div>
						<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							X
						</div>
						<Input
							type="number"
							value={module.x}
							onChange={(event) =>
								updateLayout({ x: Number(event.target.value) || 0 })
							}
						/>
					</div>
					<div>
						<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							Y
						</div>
						<Input
							type="number"
							value={module.y}
							onChange={(event) =>
								updateLayout({ y: Number(event.target.value) || 0 })
							}
						/>
					</div>
					<div>
						<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							W
						</div>
						<Input
							type="number"
							value={module.w}
							onChange={(event) =>
								updateLayout({ w: Number(event.target.value) || 1 })
							}
						/>
					</div>
					<div>
						<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
							H
						</div>
						<Input
							type="number"
							value={module.h}
							onChange={(event) =>
								updateLayout({ h: Number(event.target.value) || 1 })
							}
						/>
					</div>
				</div>

				{module.type === "text" || module.type === "textarea" ? (
					<>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Label
							</div>
							<Input
								value={module.props.label}
								onChange={(event) => updateProps({ label: event.target.value })}
							/>
						</div>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Field Key
							</div>
							<Input
								value={module.props.fieldKey}
								onChange={(event) =>
									updateProps({ fieldKey: event.target.value })
								}
							/>
						</div>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Placeholder
							</div>
							<Input
								value={module.props.placeholder}
								onChange={(event) =>
									updateProps({ placeholder: event.target.value })
								}
							/>
						</div>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Default Value
							</div>
							<Input
								value={module.props.defaultValue}
								onChange={(event) =>
									updateProps({ defaultValue: event.target.value })
								}
							/>
						</div>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Formula
							</div>
							<Input
								value={module.props.formula}
								onChange={(event) =>
									updateProps({ formula: event.target.value })
								}
								placeholder="floor((STR - 10) / 2)"
							/>
						</div>
					</>
				) : null}

				{module.type === "checkbox" ? (
					<>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Label
							</div>
							<Input
								value={module.props.label}
								onChange={(event) => updateProps({ label: event.target.value })}
							/>
						</div>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Field Key
							</div>
							<Input
								value={module.props.fieldKey}
								onChange={(event) =>
									updateProps({ fieldKey: event.target.value })
								}
							/>
						</div>
						<div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
							<div>
								<div className="text-sm font-medium">Default checked</div>
								<div className="text-xs text-muted-foreground">
									Used when no stored value exists
								</div>
							</div>
							<Switch
								checked={module.props.defaultChecked}
								onCheckedChange={(checked) =>
									updateProps({ defaultChecked: checked })
								}
							/>
						</div>
					</>
				) : null}

				{module.type === "bar" ? (
					<>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Label
							</div>
							<Input
								value={module.props.label}
								onChange={(event) => updateProps({ label: event.target.value })}
							/>
						</div>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Current Field
							</div>
							<Select
								value={module.props.currentFieldKey || "__empty"}
								onValueChange={(value) => {
									if (value == null) return;
									updateProps({
										currentFieldKey: value === "__empty" ? "" : value,
									});
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__empty">None</SelectItem>
									{fieldOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Max Field
							</div>
							<Select
								value={module.props.maxFieldKey || "__empty"}
								onValueChange={(value) => {
									if (value == null) return;
									updateProps({
										maxFieldKey: value === "__empty" ? "" : value,
									});
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__empty">None</SelectItem>
									{fieldOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
							<div>
								<div className="text-sm font-medium">Show values</div>
								<div className="text-xs text-muted-foreground">
									Display current/max alongside the bar
								</div>
							</div>
							<Switch
								checked={module.props.showValues}
								onCheckedChange={(checked) =>
									updateProps({ showValues: checked })
								}
							/>
						</div>
					</>
				) : null}
			</div>
		</div>
	);
}

export default function CharacterSheetWorkspace() {
	const activeSheet = useSheetStore((state) => state.activeSheet);
	const mode = useSheetStore((state) => state.mode);
	const selectedModuleId = useSheetStore((state) => state.selectedModuleId);
	const setSelectedModuleId = useSheetStore(
		(state) => state.setSelectedModuleId,
	);
	const addModule = useSheetStore((state) => state.addModule);
	const replaceActiveSheetLocal = useSheetStore(
		(state) => state.replaceActiveSheetLocal,
	);
	const saveActiveSheet = useSheetStore((state) => state.saveActiveSheet);
	const setFieldValue = useSheetStore((state) => state.setFieldValue);
	const canvasRef = useRef<HTMLDivElement>(null);
	const [interaction, setInteraction] = useState<InteractionState | null>(null);
	const evaluated = useMemo(
		() => (activeSheet ? evaluateSheetDocument(activeSheet) : null),
		[activeSheet],
	);

	useEffect(() => {
		if (!interaction || !activeSheet || mode !== "edit") return;

		const handlePointerMove = (event: PointerEvent) => {
			const deltaX = event.clientX - interaction.startClientX;
			const deltaY = event.clientY - interaction.startClientY;
			const stepX = Math.round(deltaX / activeSheet.grid.cellSize);
			const stepY = Math.round(deltaY / activeSheet.grid.cellSize);

			if (interaction.type === "drag") {
				const source = activeSheet.modules.find(
					(module) => module.id === interaction.moduleId,
				);
				if (!source) return;
				const next = normalizeRect(
					{
						...source,
						x: interaction.initialX + stepX,
						y: interaction.initialY + stepY,
					},
					activeSheet,
				);
				if (collides(next, activeSheet.modules)) return;
				replaceActiveSheetLocal({
					...activeSheet,
					meta: {
						...activeSheet.meta,
						updatedAt: new Date().toISOString(),
					},
					modules: activeSheet.modules.map((module) =>
						module.id === interaction.moduleId ? next : module,
					),
				});
			}

			if (interaction.type === "resize") {
				const source = activeSheet.modules.find(
					(module) => module.id === interaction.moduleId,
				);
				if (!source) return;
				const block = SHEET_BLOCK_MAP[source.type];
				const next = normalizeRect(
					{
						...source,
						w: interaction.initialW + stepX,
						h: interaction.initialH + stepY,
					},
					activeSheet,
				);
				next.w = clamp(next.w, block.minW, activeSheet.grid.columns - next.x);
				next.h = clamp(next.h, block.minH, activeSheet.grid.rows - next.y);
				if (collides(next, activeSheet.modules)) return;
				replaceActiveSheetLocal({
					...activeSheet,
					meta: {
						...activeSheet.meta,
						updatedAt: new Date().toISOString(),
					},
					modules: activeSheet.modules.map((module) =>
						module.id === interaction.moduleId ? next : module,
					),
				});
			}
		};

		const handlePointerUp = () => {
			setInteraction(null);
			saveActiveSheet();
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [
		interaction,
		activeSheet,
		mode,
		replaceActiveSheetLocal,
		saveActiveSheet,
	]);

	if (!activeSheet) {
		return (
			<div className="flex h-full items-center justify-center p-8">
				<div className="max-w-md rounded-3xl border border-dashed border-border/80 bg-background/70 px-8 py-10 text-center">
					<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<PanelRightOpen className="size-6" />
					</div>
					<h2 className="text-xl font-semibold">No sheet selected</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Open the Character Sheet tab in the sidebar and create or select a
						sheet document.
					</p>
				</div>
			</div>
		);
	}

	const pageWidth = activeSheet.grid.columns * activeSheet.grid.cellSize;
	const pageHeight = activeSheet.grid.rows * activeSheet.grid.cellSize;
	const selectedModule =
		activeSheet.modules.find((module) => module.id === selectedModuleId) ??
		null;

	return (
		<div className="flex h-full min-h-0">
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex min-h-full justify-center p-6">
					<div className="w-full max-w-[calc(100vw-32rem)] min-w-0">
						<div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 backdrop-blur-sm">
							<div>
								<h1 className="text-xl font-semibold">
									{activeSheet.meta.name}
								</h1>
								<p className="text-sm text-muted-foreground">
									{mode === "edit"
										? "Drag blocks from the sidebar, move them on the grid, and resize with the corner handle."
										: "Interact with the sheet values. Derived formula fields remain read-only."}
								</p>
							</div>
							<div className="rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
								{mode}
							</div>
						</div>

						<div className="overflow-auto rounded-[2rem] border border-border/70 bg-linear-to-br from-background via-background to-muted/35 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
							<div
								ref={canvasRef}
								onDragOver={(event) => {
									if (mode !== "edit") return;
									event.preventDefault();
									event.dataTransfer.dropEffect = "copy";
								}}
								onDrop={(event) => {
									if (mode !== "edit") return;
									event.preventDefault();
									const type = event.dataTransfer.getData(
										"application/x-sheet-block",
									) as SheetModuleType;
									if (!type) return;
									const rect = event.currentTarget.getBoundingClientRect();
									const x = clamp(
										Math.floor(
											(event.clientX - rect.left) / activeSheet.grid.cellSize,
										),
										0,
										activeSheet.grid.columns - 1,
									);
									const y = clamp(
										Math.floor(
											(event.clientY - rect.top) / activeSheet.grid.cellSize,
										),
										0,
										activeSheet.grid.rows - 1,
									);
									addModule(type, { x, y });
								}}
								className="relative mx-auto overflow-hidden rounded-[1.5rem] border border-border/90 bg-background shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
								style={{
									width: pageWidth,
									height: pageHeight,
									backgroundImage:
										mode === "edit"
											? `linear-gradient(to right, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px)`
											: undefined,
									backgroundSize:
										mode === "edit"
											? `${activeSheet.grid.cellSize}px ${activeSheet.grid.cellSize}px`
											: undefined,
								}}
							>
								<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_50%)]" />
								{activeSheet.modules.map((module) => {
									const definition = SHEET_BLOCK_MAP[module.type];
									return (
										<div
											key={module.id}
											onPointerDown={() =>
												mode === "edit" && setSelectedModuleId(module.id)
											}
											className={cn(
												"absolute overflow-hidden rounded-2xl border bg-card/95 p-3 shadow-sm transition-shadow",
												selectedModuleId === module.id
													? "border-primary shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_40%,transparent),0_12px_26px_rgba(0,0,0,0.14)]"
													: "border-border/70",
												mode === "edit" && "cursor-pointer",
											)}
											style={{
												left: module.x * activeSheet.grid.cellSize,
												top: module.y * activeSheet.grid.cellSize,
												width: module.w * activeSheet.grid.cellSize,
												height: module.h * activeSheet.grid.cellSize,
											}}
										>
											{mode === "edit" && (
												<div
													className="mb-2 flex cursor-grab items-center justify-between gap-2 rounded-lg bg-muted/45 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground active:cursor-grabbing"
													onPointerDown={(event) => {
														event.stopPropagation();
														setSelectedModuleId(module.id);
														setInteraction({
															type: "drag",
															moduleId: module.id,
															startClientX: event.clientX,
															startClientY: event.clientY,
															initialX: module.x,
															initialY: module.y,
														});
													}}
												>
													<span className="truncate">{definition.label}</span>
													<Grip className="size-3.5 shrink-0" />
												</div>
											)}
											<div className="relative h-[calc(100%-2rem)] min-h-0">
												{definition.render(module, {
													mode,
													values: evaluated?.values ?? {},
													onValueChange: (fieldKey, value) =>
														setFieldValue(fieldKey, value),
												})}
											</div>
											{mode === "edit" && (
												<button
													type="button"
													className="absolute right-1 bottom-1 flex size-5 cursor-se-resize items-center justify-center rounded bg-primary/15 text-primary"
													onPointerDown={(event) => {
														event.stopPropagation();
														setSelectedModuleId(module.id);
														setInteraction({
															type: "resize",
															moduleId: module.id,
															startClientX: event.clientX,
															startClientY: event.clientY,
															initialW: module.w,
															initialH: module.h,
														});
													}}
												>
													<Grip className="size-3 rotate-45" />
												</button>
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</ScrollArea>

			<div className="w-[22rem] shrink-0 border-l border-border/70 bg-background/65 p-4">
				<div className="mb-4">
					<div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
						Inspector
					</div>
					<p className="mt-1 text-sm text-muted-foreground">
						Configure the selected module and review formula status.
					</p>
				</div>

				{evaluated && evaluated.issues.length > 0 && (
					<div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
						<div className="mb-2 flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
							<TriangleAlert className="size-4" />
							Formula issues
						</div>
						<div className="space-y-2 text-amber-800 dark:text-amber-200">
							{evaluated.issues.map((issue) => (
								<div key={`${issue.fieldKey}-${issue.message}`}>
									<div className="font-mono text-xs">{issue.fieldKey}</div>
									<div>{issue.message}</div>
								</div>
							))}
						</div>
					</div>
				)}

				<ModuleInspector
					module={selectedModule}
					document={activeSheet}
					mode={mode}
				/>

				<Separator className="my-4" />

				<div className="rounded-2xl border border-border/70 bg-background/70 p-4">
					<div className="mb-2 text-sm font-semibold">Grid</div>
					<div className="text-xs text-muted-foreground">
						{activeSheet.grid.columns} columns x {activeSheet.grid.rows} rows
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Cell size {activeSheet.grid.cellSize}px
					</div>
				</div>
			</div>
		</div>
	);
}
