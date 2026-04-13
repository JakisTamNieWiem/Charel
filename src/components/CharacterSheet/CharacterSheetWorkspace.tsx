import {
	Grip,
	PanelRightOpen,
	Plus,
	Trash2,
	TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Slider } from "@/components/ui/slider";
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
import { getSheetPage, isFieldModule, replaceSheetPage } from "@/types/sheets";
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

function collides(
	target: SheetModule,
	modules: SheetModule[],
	ignoreId?: string,
) {
	return modules.some((module) => {
		if (module.id === ignoreId || module.id === target.id) return false;
		return !(
			target.x + target.w <= module.x ||
			module.x + module.w <= target.x ||
			target.y + target.h <= module.y ||
			module.y + module.h <= target.y
		);
	});
}

function normalizeModule(module: SheetModule, document: SheetDocument) {
	const minimums = SHEET_BLOCK_MAP[module.type];
	const width = clamp(module.w, minimums.minW, document.grid.columns);
	const height = clamp(module.h, minimums.minH, document.grid.rows);
	return {
		...module,
		w: width,
		h: height,
		x: clamp(module.x, 0, Math.max(0, document.grid.columns - width)),
		y: clamp(module.y, 0, Math.max(0, document.grid.rows - height)),
	};
}

function getFieldOptions(document: SheetDocument | null) {
	if (!document) return [];
	return document.pages.flatMap((page) =>
		page.modules.filter(isFieldModule).map((module) => ({
			value: module.props.fieldKey,
			label: module.props.label || module.props.fieldKey,
			page: page.name,
		})),
	);
}

function applyModulePatch(
	document: SheetDocument,
	pageId: string,
	moduleId: string,
	nextModule: SheetModule,
) {
	return replaceSheetPage(document, pageId, (page) => ({
		...page,
		modules: page.modules.map((module) =>
			module.id === moduleId ? nextModule : module,
		),
	}));
}

function ModuleInspector({
	module,
	document,
	activePageId,
	mode,
	onValidatedModuleChange,
}: {
	module: SheetModule | null;
	document: SheetDocument | null;
	activePageId: string | null;
	mode: SheetViewMode;
	onValidatedModuleChange: (moduleId: string, nextModule: SheetModule) => void;
}) {
	const deleteModule = useSheetStore((state) => state.deleteModule);
	const fieldOptions = useMemo(() => getFieldOptions(document), [document]);

	if (!module || !document || !activePageId) {
		return (
			<div className="rounded-xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
				Select a module in edit mode to configure it.
			</div>
		);
	}

	const updateProps = (patch: Record<string, unknown>) =>
		onValidatedModuleChange(module.id, {
			...module,
			props: { ...module.props, ...patch },
		} as SheetModule);
	const updateLayout = (
		patch: Partial<Pick<SheetModule, "x" | "y" | "w" | "h">>,
	) =>
		onValidatedModuleChange(module.id, {
			...module,
			...patch,
		});

	return (
		<div className="rounded-xl border border-border/70 bg-background/60 p-4">
			<div className="mb-4 flex items-center justify-between gap-2">
				<div>
					<div className="text-sm font-semibold">
						{SHEET_BLOCK_MAP[module.type].label}
					</div>
					<div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						{mode === "edit" ? "Module Settings" : "View Details"}
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

				{(module.type === "text" || module.type === "textarea") && (
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
							/>
						</div>
					</>
				)}

				{module.type === "number" && (
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
						<div className="grid grid-cols-2 gap-2">
							<Input
								value={module.props.prefix}
								onChange={(event) =>
									updateProps({ prefix: event.target.value })
								}
								placeholder="Prefix"
							/>
							<Input
								value={module.props.suffix}
								onChange={(event) =>
									updateProps({ suffix: event.target.value })
								}
								placeholder="Suffix"
							/>
						</div>
						<Input
							value={module.props.defaultValue}
							onChange={(event) =>
								updateProps({ defaultValue: event.target.value })
							}
							placeholder="Default value"
						/>
						<Input
							value={module.props.formula}
							onChange={(event) => updateProps({ formula: event.target.value })}
							placeholder="floor((STR - 10) / 2)"
						/>
					</>
				)}

				{module.type === "checkbox" && (
					<>
						<Input
							value={module.props.label}
							onChange={(event) => updateProps({ label: event.target.value })}
							placeholder="Label"
						/>
						<Input
							value={module.props.fieldKey}
							onChange={(event) =>
								updateProps({ fieldKey: event.target.value })
							}
							placeholder="Field key"
						/>
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
				)}

				{module.type === "bar" && (
					<>
						<Input
							value={module.props.label}
							onChange={(event) => updateProps({ label: event.target.value })}
							placeholder="Label"
						/>
						<div>
							<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								Current Field
							</div>
							<Select
								value={module.props.currentFieldKey || "__empty"}
								onValueChange={(value) => {
									if (!value) return;
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
											{option.label} - {option.page}
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
									if (!value) return;
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
											{option.label} - {option.page}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
							<div className="text-sm font-medium">Show values</div>
							<Switch
								checked={module.props.showValues}
								onCheckedChange={(checked) =>
									updateProps({ showValues: checked })
								}
							/>
						</div>
					</>
				)}

				{module.type === "heading" && (
					<>
						<Input
							value={module.props.title}
							onChange={(event) => updateProps({ title: event.target.value })}
							placeholder="Heading"
						/>
						<Input
							value={module.props.subtitle}
							onChange={(event) =>
								updateProps({ subtitle: event.target.value })
							}
							placeholder="Subtitle"
						/>
						<Select
							value={module.props.align}
							onValueChange={(value) => {
								if (!value) return;
								updateProps({ align: value });
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="start">Left</SelectItem>
								<SelectItem value="center">Center</SelectItem>
							</SelectContent>
						</Select>
					</>
				)}

				{module.type === "divider" && (
					<>
						<Input
							value={module.props.label}
							onChange={(event) => updateProps({ label: event.target.value })}
							placeholder="Divider label"
						/>
						<Select
							value={module.props.style}
							onValueChange={(value) => {
								if (!value) return;
								updateProps({ style: value });
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="solid">Solid</SelectItem>
								<SelectItem value="dashed">Dashed</SelectItem>
								<SelectItem value="ornate">Ornate</SelectItem>
							</SelectContent>
						</Select>
					</>
				)}
			</div>
		</div>
	);
}

export default function CharacterSheetWorkspace() {
	const activeSheet = useSheetStore((state) => state.activeSheet);
	const activePageId = useSheetStore((state) => state.activePageId);
	const mode = useSheetStore((state) => state.mode);
	const selectedModuleId = useSheetStore((state) => state.selectedModuleId);
	const paletteDrag = useSheetStore((state) => state.paletteDrag);
	const setSelectedModuleId = useSheetStore(
		(state) => state.setSelectedModuleId,
	);
	const setActivePageId = useSheetStore((state) => state.setActivePageId);
	const addPage = useSheetStore((state) => state.addPage);
	const renamePage = useSheetStore((state) => state.renamePage);
	const deletePage = useSheetStore((state) => state.deletePage);
	const addModule = useSheetStore((state) => state.addModule);
	const deleteModule = useSheetStore((state) => state.deleteModule);
	const replaceActiveSheetLocal = useSheetStore(
		(state) => state.replaceActiveSheetLocal,
	);
	const saveActiveSheet = useSheetStore((state) => state.saveActiveSheet);
	const setFieldValue = useSheetStore((state) => state.setFieldValue);

	const [interaction, setInteraction] = useState<InteractionState | null>(null);
	const [zoomPercent, setZoomPercent] = useState(115);
	const [pageNameDraft, setPageNameDraft] = useState("");
	const evaluated = useMemo(
		() => (activeSheet ? evaluateSheetDocument(activeSheet) : null),
		[activeSheet],
	);

	const activePage = activeSheet
		? getSheetPage(activeSheet, activePageId)
		: null;
	const selectedModule =
		activePage?.modules.find((module) => module.id === selectedModuleId) ??
		null;
	const zoom = zoomPercent / 100;

	useEffect(() => {
		setPageNameDraft(activePage?.name ?? "");
	}, [activePage?.name]);

	useEffect(() => {
		if (!selectedModuleId || mode !== "edit") return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Delete") return;
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			event.preventDefault();
			deleteModule(selectedModuleId);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [mode, selectedModuleId, deleteModule]);

	const onValidatedModuleChange = (
		moduleId: string,
		nextModule: SheetModule,
	) => {
		if (!activeSheet || !activePage) return;
		const candidate = normalizeModule(nextModule, activeSheet);
		if (collides(candidate, activePage.modules, moduleId)) return;
		void useSheetStore.getState().updateModule(moduleId, () => candidate);
	};

	useEffect(() => {
		if (!interaction || !activeSheet || !activePage || mode !== "edit") return;

		const stepSize = activeSheet.grid.cellSize * zoom;

		const handlePointerMove = (event: PointerEvent) => {
			const deltaX = event.clientX - interaction.startClientX;
			const deltaY = event.clientY - interaction.startClientY;
			const stepX = Math.round(deltaX / stepSize);
			const stepY = Math.round(deltaY / stepSize);
			const source = activePage.modules.find(
				(module) => module.id === interaction.moduleId,
			);
			if (!source) return;

			if (interaction.type === "drag") {
				const candidate = normalizeModule(
					{
						...source,
						x: interaction.initialX + stepX,
						y: interaction.initialY + stepY,
					},
					activeSheet,
				);
				if (collides(candidate, activePage.modules, source.id)) return;
				const nextDocument = applyModulePatch(
					activeSheet,
					activePage.id,
					source.id,
					candidate,
				);
				replaceActiveSheetLocal({
					...nextDocument,
					meta: {
						...nextDocument.meta,
						updatedAt: new Date().toISOString(),
					},
				});
			}

			if (interaction.type === "resize") {
				const candidate = normalizeModule(
					{
						...source,
						w: interaction.initialW + stepX,
						h: interaction.initialH + stepY,
					},
					activeSheet,
				);
				if (collides(candidate, activePage.modules, source.id)) return;
				const nextDocument = applyModulePatch(
					activeSheet,
					activePage.id,
					source.id,
					candidate,
				);
				replaceActiveSheetLocal({
					...nextDocument,
					meta: {
						...nextDocument.meta,
						updatedAt: new Date().toISOString(),
					},
				});
			}
		};

		const handlePointerUp = () => {
			setInteraction(null);
			void saveActiveSheet();
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
		activePage,
		mode,
		zoom,
		saveActiveSheet,
		replaceActiveSheetLocal,
	]);

	useEffect(() => {
		if (!activeSheet || !activePage || mode !== "edit") return;

		const handlePaletteDrop = (event: Event) => {
			const customEvent = event as CustomEvent<{
				type: SheetModuleType;
				clientX: number;
				clientY: number;
				targetRect?: DOMRect;
			}>;
			const canvas = document.getElementById("sheet-canvas-page");
			const rect = canvas?.getBoundingClientRect();
			if (!rect) return;
			if (
				customEvent.detail.clientX < rect.left ||
				customEvent.detail.clientX > rect.right ||
				customEvent.detail.clientY < rect.top ||
				customEvent.detail.clientY > rect.bottom
			) {
				return;
			}
			const x = clamp(
				Math.floor(
					(customEvent.detail.clientX - rect.left) /
						(activeSheet.grid.cellSize * zoom),
				),
				0,
				activeSheet.grid.columns - 1,
			);
			const y = clamp(
				Math.floor(
					(customEvent.detail.clientY - rect.top) /
						(activeSheet.grid.cellSize * zoom),
				),
				0,
				activeSheet.grid.rows - 1,
			);
			void addModule(customEvent.detail.type, { x, y });
		};

		window.addEventListener(
			"sheet-palette-drop",
			handlePaletteDrop as EventListener,
		);
		return () => {
			window.removeEventListener(
				"sheet-palette-drop",
				handlePaletteDrop as EventListener,
			);
		};
	}, [activeSheet, activePage, mode, addModule, zoom]);

	if (!activeSheet || !activePage) {
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

	return (
		<div className="flex h-full min-h-0 flex-col xl:flex-row">
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex min-h-full flex-col p-5">
					<div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
						<div>
							<h1 className="text-xl font-semibold">{activeSheet.meta.name}</h1>
							<p className="text-sm text-muted-foreground">
								{mode === "edit"
									? "Build pages, place modules on the paper, and keep the layout clean."
									: "Use the sheet. Linked and derived values stay in sync across pages."}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<div className="w-40">
								<div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
									<span>Zoom</span>
									<span>{zoomPercent}%</span>
								</div>
								<Slider
									value={[zoomPercent]}
									onValueChange={(value) =>
										setZoomPercent(
											Array.isArray(value) ? (value[0] ?? 115) : 115,
										)
									}
									min={65}
									max={220}
									step={5}
								/>
							</div>
							<div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
								{mode === "edit" ? "Edit Mode" : "View Mode"}
							</div>
						</div>
					</div>

					<div className="mb-4 flex flex-wrap items-center gap-2">
						{activeSheet.pages.map((page, index) => (
							<Button
								key={page.id}
								variant={activePage.id === page.id ? "default" : "outline"}
								size="sm"
								onClick={() => setActivePageId(page.id)}
								className="rounded-full"
							>
								{index + 1}. {page.name}
							</Button>
						))}
						<Button size="sm" variant="outline" onClick={() => addPage()}>
							<Plus className="mr-2 size-4" />
							Page
						</Button>
					</div>

					<div className="overflow-auto rounded-[2rem] border border-border/70 bg-background/35 p-5">
						<div
							className="mx-auto min-w-max"
							style={{
								width: pageWidth * zoom,
								height: pageHeight * zoom,
							}}
						>
							<div
								id="sheet-canvas-page"
								className={cn(
									"relative origin-top-left overflow-hidden rounded-[1.2rem] border border-border/60",
									paletteDrag && mode === "edit" && "ring-1 ring-primary/40",
								)}
								style={{
									width: pageWidth,
									height: pageHeight,
									transform: `scale(${zoom})`,
									backgroundColor:
										"color-mix(in srgb, var(--background) 92%, var(--foreground) 8%)",
									boxShadow:
										"inset 0 0 0 1px color-mix(in srgb, var(--border) 82%, transparent)",
									backgroundImage:
										mode === "edit"
											? `linear-gradient(to right, color-mix(in srgb, var(--border) 28%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border) 28%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 2%, transparent), transparent 60%)`
											: "linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 2%, transparent), transparent 60%)",
									backgroundSize:
										mode === "edit"
											? `${activeSheet.grid.cellSize}px ${activeSheet.grid.cellSize}px, ${activeSheet.grid.cellSize}px ${activeSheet.grid.cellSize}px, 100% 100%`
											: "100% 100%",
								}}
							>
								<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_94%,rgba(255,255,255,0.025)_100%)]" />

								{activePage.modules.map((module) => {
									const definition = SHEET_BLOCK_MAP[module.type];
									const isSelected = selectedModuleId === module.id;
									return (
										<div
											key={module.id}
											onPointerDown={() =>
												mode === "edit" && setSelectedModuleId(module.id)
											}
											className={cn(
												"group/module absolute p-1.5 transition-colors",
												mode === "edit" && "hover:bg-foreground/[0.025]",
												isSelected &&
													"bg-primary/[0.045] outline outline-1 outline-primary/70",
											)}
											style={{
												left: module.x * activeSheet.grid.cellSize,
												top: module.y * activeSheet.grid.cellSize,
												width: module.w * activeSheet.grid.cellSize,
												height: module.h * activeSheet.grid.cellSize,
											}}
										>
											<div className="relative h-full min-h-0">
												{definition.render(module, {
													mode,
													values: evaluated?.values ?? {},
													onValueChange: (fieldKey, value) =>
														setFieldValue(fieldKey, value),
												})}
											</div>

											{mode === "edit" && (
												<>
													<button
														type="button"
														className={cn(
															"absolute -top-2 left-0 flex h-5 items-center gap-1 border border-border/60 bg-background/90 px-1.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground opacity-0 transition-opacity group-hover/module:opacity-100",
															isSelected && "opacity-100",
														)}
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
														<Grip className="size-3" />
														{definition.label}
													</button>
													<button
														type="button"
														className={cn(
															"absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center border border-border/60 bg-background/90 text-muted-foreground opacity-0 transition-opacity group-hover/module:opacity-100",
															isSelected && "opacity-100",
														)}
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
												</>
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</ScrollArea>

			<div className="w-full shrink-0 border-t border-border/70 bg-background/60 p-4 xl:w-[22rem] xl:border-t-0 xl:border-l">
				<div className="mb-4">
					<div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
						Inspector
					</div>
					<p className="mt-1 text-sm text-muted-foreground">
						Selected module settings, page details, and formula warnings.
					</p>
				</div>

				<div className="mb-4 rounded-xl border border-border/70 bg-background/60 p-4">
					<div className="mb-2 flex items-center justify-between gap-2">
						<div className="text-sm font-semibold">Page</div>
						{activeSheet.pages.length > 1 && (
							<Button
								size="icon-sm"
								variant="ghost"
								className="text-destructive hover:text-destructive"
								onClick={() => deletePage(activePage.id)}
							>
								<Trash2 className="size-4" />
							</Button>
						)}
					</div>
					{mode === "edit" ? (
						<Input
							value={pageNameDraft}
							onChange={(event) => setPageNameDraft(event.target.value)}
							onBlur={() => renamePage(activePage.id, pageNameDraft)}
						/>
					) : (
						<div className="text-sm text-foreground">{activePage.name}</div>
					)}
				</div>

				{evaluated && evaluated.issues.length > 0 && (
					<div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
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
					activePageId={activePage.id}
					mode={mode}
					onValidatedModuleChange={onValidatedModuleChange}
				/>

				<Separator className="my-4" />

				<div className="rounded-xl border border-border/70 bg-background/60 p-4">
					<div className="mb-2 text-sm font-semibold">Grid</div>
					<div className="text-xs text-muted-foreground">
						{activeSheet.grid.columns} columns x {activeSheet.grid.rows} rows
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Cell size {activeSheet.grid.cellSize}px
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Delete key removes the selected module in edit mode.
					</div>
				</div>
			</div>
		</div>
	);
}
