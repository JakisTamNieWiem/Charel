import { toast } from "sonner";
import { create } from "zustand";
import {
	deleteSheetDocument,
	getSheetFileName,
	loadSheetDocument,
	loadSheetIndex,
	saveSheetDocument,
	saveSheetIndex,
	upsertSheetIndexEntry,
} from "@/lib/sheet-storage";
import {
	createDefaultSheet,
	createDefaultSheetPage,
	getAllSheetModules,
	getSheetPage,
	replaceSheetPage,
	SHEET_RESOLUTIONS,
	type SheetDocument,
	type SheetFieldValue,
	type SheetGridSettings,
	type SheetIndexEntry,
	type SheetModule,
	type SheetModuleType,
	type SheetPage,
	type SheetViewMode,
} from "@/types/sheets";

interface PaletteDragState {
	type: SheetModuleType;
	clientX: number;
	clientY: number;
}

interface SheetStoreState {
	isInitialized: boolean;
	isLoading: boolean;
	mode: SheetViewMode;
	selectedModuleId: string | null;
	activePageId: string | null;
	paletteDrag: PaletteDragState | null;
	sheets: SheetIndexEntry[];
	activeSheetId: string | null;
	activeSheet: SheetDocument | null;
	initialize: () => Promise<void>;
	selectSheet: (id: string) => Promise<void>;
	createSheet: (name?: string) => Promise<void>;
	renameSheet: (id: string, name: string) => Promise<void>;
	duplicateSheet: (id: string) => Promise<void>;
	deleteSheet: (id: string) => Promise<void>;
	setMode: (mode: SheetViewMode) => void;
	setSelectedModuleId: (moduleId: string | null) => void;
	setPaletteDrag: (paletteDrag: PaletteDragState | null) => void;
	setActivePageId: (pageId: string) => void;
	addPage: (name?: string) => Promise<void>;
	renamePage: (pageId: string, name: string) => Promise<void>;
	deletePage: (pageId: string) => Promise<void>;
	replaceActiveSheetLocal: (document: SheetDocument) => void;
	saveActiveSheet: () => Promise<void>;
	addModule: (
		type: SheetModuleType,
		position?: Pick<SheetModule, "x" | "y">,
	) => Promise<void>;
	updateModule: (
		moduleId: string,
		updater: (module: SheetModule) => SheetModule,
	) => Promise<void>;
	deleteModule: (moduleId: string) => Promise<void>;
	updateGrid: (grid: SheetGridSettings) => Promise<void>;
	setFieldValue: (fieldKey: string, value: SheetFieldValue) => Promise<void>;
}

const moduleDefaults: Record<
	SheetModuleType,
	{
		w: number;
		h: number;
		minW: number;
		minH: number;
		props: SheetModule["props"];
	}
> = {
	text: {
		w: 4,
		h: 2,
		minW: 2,
		minH: 2,
		props: {
			label: "Text Field",
			fieldKey: "field_text",
			placeholder: "Enter value",
			defaultValue: "",
			formula: "",
		},
	},
	textarea: {
		w: 6,
		h: 4,
		minW: 3,
		minH: 3,
		props: {
			label: "Text Area",
			fieldKey: "field_notes",
			placeholder: "Enter notes",
			defaultValue: "",
			formula: "",
		},
	},
	checkbox: {
		w: 3,
		h: 2,
		minW: 2,
		minH: 2,
		props: {
			label: "Checkbox",
			fieldKey: "field_check",
			defaultChecked: false,
		},
	},
	bar: {
		w: 6,
		h: 2,
		minW: 3,
		minH: 2,
		props: {
			label: "Progress Bar",
			currentFieldKey: "",
			maxFieldKey: "",
			showValues: true,
		},
	},
	number: {
		w: 3,
		h: 3,
		minW: 2,
		minH: 3,
		props: {
			label: "Score",
			fieldKey: "field_score",
			defaultValue: "10",
			formula: "",
			prefix: "",
			suffix: "",
		},
	},
	heading: {
		w: 6,
		h: 2,
		minW: 4,
		minH: 2,
		props: {
			title: "Section Heading",
			subtitle: "Optional section note",
			align: "start",
		},
	},
	divider: {
		w: 6,
		h: 1,
		minW: 4,
		minH: 1,
		props: {
			label: "",
			style: "solid",
		},
	},
};

function createModule(type: SheetModuleType, x = 0, y = 0): SheetModule {
	const defaults = moduleDefaults[type];
	return {
		id: crypto.randomUUID(),
		type,
		x,
		y,
		w: defaults.w,
		h: defaults.h,
		props: structuredClone(defaults.props),
	} as SheetModule;
}

function collide(
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

function clampModuleToGrid(
	module: SheetModule,
	grid: SheetGridSettings,
): SheetModule {
	const minimums = moduleDefaults[module.type];
	const width = Math.max(minimums.minW, Math.min(module.w, grid.columns));
	const height = Math.max(minimums.minH, Math.min(module.h, grid.rows));
	return {
		...module,
		x: Math.max(0, Math.min(module.x, Math.max(0, grid.columns - width))),
		y: Math.max(0, Math.min(module.y, Math.max(0, grid.rows - height))),
		w: width,
		h: height,
	};
}

function findPlacement(
	page: SheetPage,
	grid: SheetGridSettings,
	module: SheetModule,
	preferred?: Pick<SheetModule, "x" | "y">,
) {
	const candidate = clampModuleToGrid(
		{
			...module,
			x: preferred?.x ?? module.x,
			y: preferred?.y ?? module.y,
		},
		grid,
	);
	if (!collide(candidate, page.modules)) {
		return candidate;
	}

	for (let y = 0; y <= grid.rows - candidate.h; y += 1) {
		for (let x = 0; x <= grid.columns - candidate.w; x += 1) {
			const next = { ...candidate, x, y };
			if (!collide(next, page.modules)) {
				return next;
			}
		}
	}

	return null;
}

function repairPage(page: SheetPage, grid: SheetGridSettings): SheetPage {
	const repaired: SheetModule[] = [];
	for (const rawModule of page.modules) {
		const module = clampModuleToGrid(rawModule, grid);
		if (!collide(module, repaired)) {
			repaired.push(module);
			continue;
		}
		const found = findPlacement({ ...page, modules: repaired }, grid, module);
		if (found) repaired.push(found);
	}
	return { ...page, modules: repaired };
}

function repairSheetDocument(document: SheetDocument): SheetDocument {
	const pages =
		document.pages.length > 0 ? document.pages : [createDefaultSheetPage()];
	return {
		...document,
		version: "2",
		pages: pages.map((page) => repairPage(page, document.grid)),
	};
}

function makeUniqueFieldKey(document: SheetDocument, base: string) {
	const existing = new Set(
		getAllSheetModules(document)
			.filter((module) => "fieldKey" in module.props)
			.map((module) =>
				"fieldKey" in module.props ? module.props.fieldKey : "",
			),
	);
	let candidate = base;
	let suffix = 1;
	while (existing.has(candidate)) {
		candidate = `${base}_${suffix}`;
		suffix += 1;
	}
	return candidate;
}

function updateMeta(document: SheetDocument): SheetDocument {
	return {
		...document,
		meta: {
			...document.meta,
			updatedAt: new Date().toISOString(),
		},
	};
}

async function persistDocument(document: SheetDocument) {
	await saveSheetDocument(document);
	const index = await loadSheetIndex();
	const nextEntry: SheetIndexEntry = {
		...document.meta,
		fileName: getSheetFileName(document.meta.id),
	};
	const nextSheets = upsertSheetIndexEntry(index.sheets, nextEntry).sort(
		(a, b) => a.name.localeCompare(b.name),
	);
	await saveSheetIndex({
		...index,
		sheets: nextSheets,
		activeSheetId: document.meta.id,
	});
	return nextSheets;
}

function transformModulesForGrid(
	modules: SheetModule[],
	prevGrid: SheetGridSettings,
	nextGrid: SheetGridSettings,
) {
	const scaleX = nextGrid.columns / prevGrid.columns;
	const scaleY = nextGrid.rows / prevGrid.rows;
	return modules.map((module) =>
		clampModuleToGrid(
			{
				...module,
				x: Math.round(module.x * scaleX),
				y: Math.round(module.y * scaleY),
				w: Math.max(1, Math.round(module.w * scaleX)),
				h: Math.max(1, Math.round(module.h * scaleY)),
			},
			nextGrid,
		),
	);
}

export const useSheetStore = create<SheetStoreState>((set, get) => ({
	isInitialized: false,
	isLoading: false,
	mode: "edit",
	selectedModuleId: null,
	activePageId: null,
	paletteDrag: null,
	sheets: [],
	activeSheetId: null,
	activeSheet: null,
	initialize: async () => {
		if (get().isInitialized || get().isLoading) return;
		set({ isLoading: true });
		try {
			const index = await loadSheetIndex();
			let activeSheet: SheetDocument | null = null;
			if (index.activeSheetId) {
				const activeEntry = index.sheets.find(
					(item) => item.id === index.activeSheetId,
				);
				if (activeEntry) {
					const loaded = await loadSheetDocument(activeEntry.fileName);
					activeSheet = loaded ? repairSheetDocument(loaded) : null;
				}
			}
			set({
				sheets: index.sheets,
				activeSheetId: activeSheet?.meta.id ?? index.activeSheetId ?? null,
				activeSheet,
				activePageId: activeSheet?.pages[0]?.id ?? null,
				isInitialized: true,
				isLoading: false,
			});
		} catch (error) {
			console.error(error);
			toast.error("Failed to load sheet documents.");
			set({ isInitialized: true, isLoading: false });
		}
	},
	selectSheet: async (id) => {
		const entry = get().sheets.find((item) => item.id === id);
		if (!entry) return;
		set({ isLoading: true, selectedModuleId: null });
		const loaded = await loadSheetDocument(entry.fileName);
		const document = loaded ? repairSheetDocument(loaded) : null;
		const index = await loadSheetIndex();
		await saveSheetIndex({ ...index, activeSheetId: id });
		set({
			activeSheetId: id,
			activeSheet: document,
			activePageId: document?.pages[0]?.id ?? null,
			isLoading: false,
		});
	},
	createSheet: async (name = "Untitled Sheet") => {
		const document = createDefaultSheet(name);
		const fileName = await saveSheetDocument(document);
		const entry: SheetIndexEntry = { ...document.meta, fileName };
		const index = await loadSheetIndex();
		const nextSheets = [...index.sheets, entry].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		await saveSheetIndex({
			...index,
			activeSheetId: document.meta.id,
			sheets: nextSheets,
		});
		set({
			sheets: nextSheets,
			activeSheetId: document.meta.id,
			activeSheet: document,
			activePageId: document.pages[0]?.id ?? null,
			selectedModuleId: null,
			mode: "edit",
		});
	},
	renameSheet: async (id, name) => {
		const trimmed = name.trim();
		if (!trimmed) return;
		const { activeSheet } = get();
		const index = await loadSheetIndex();
		const entry = index.sheets.find((item) => item.id === id);
		if (!entry) return;
		const updatedAt = new Date().toISOString();
		const nextEntry = { ...entry, name: trimmed, updatedAt };
		const nextSheets = upsertSheetIndexEntry(index.sheets, nextEntry).sort(
			(a, b) => a.name.localeCompare(b.name),
		);
		await saveSheetIndex({ ...index, sheets: nextSheets });
		if (activeSheet?.meta.id === id) {
			const nextDocument = updateMeta({
				...activeSheet,
				meta: { ...activeSheet.meta, name: trimmed, updatedAt },
			});
			await saveSheetDocument(nextDocument);
			set({ activeSheet: nextDocument, sheets: nextSheets });
			return;
		}
		set({ sheets: nextSheets });
	},
	duplicateSheet: async (id) => {
		const sourceEntry = get().sheets.find((item) => item.id === id);
		if (!sourceEntry) return;
		const sourceDocument = await loadSheetDocument(sourceEntry.fileName);
		if (!sourceDocument) return;
		const now = new Date().toISOString();
		const duplicate: SheetDocument = {
			...sourceDocument,
			meta: {
				id: crypto.randomUUID(),
				name: `${sourceDocument.meta.name} Copy`,
				createdAt: now,
				updatedAt: now,
			},
			pages: sourceDocument.pages.map((page) => ({
				...page,
				id: crypto.randomUUID(),
				modules: page.modules.map((module) => ({
					...module,
					id: crypto.randomUUID(),
				})),
			})),
		};
		const fileName = await saveSheetDocument(duplicate);
		const entry: SheetIndexEntry = { ...duplicate.meta, fileName };
		const index = await loadSheetIndex();
		const nextSheets = [...index.sheets, entry].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		await saveSheetIndex({
			...index,
			sheets: nextSheets,
			activeSheetId: duplicate.meta.id,
		});
		set({
			sheets: nextSheets,
			activeSheetId: duplicate.meta.id,
			activeSheet: duplicate,
			activePageId: duplicate.pages[0]?.id ?? null,
			selectedModuleId: null,
		});
	},
	deleteSheet: async (id) => {
		const index = await loadSheetIndex();
		const entry = index.sheets.find((item) => item.id === id);
		if (!entry) return;
		await deleteSheetDocument(entry.fileName);
		const remaining = index.sheets.filter((item) => item.id !== id);
		const nextActiveId =
			index.activeSheetId === id
				? (remaining[0]?.id ?? null)
				: index.activeSheetId;
		await saveSheetIndex({
			...index,
			sheets: remaining,
			activeSheetId: nextActiveId,
		});
		let nextActiveSheet: SheetDocument | null = null;
		if (nextActiveId) {
			const nextEntry = remaining.find((item) => item.id === nextActiveId);
			if (nextEntry) {
				const loaded = await loadSheetDocument(nextEntry.fileName);
				nextActiveSheet = loaded ? repairSheetDocument(loaded) : null;
			}
		}
		set({
			sheets: remaining,
			activeSheetId: nextActiveId,
			activeSheet: nextActiveSheet,
			activePageId: nextActiveSheet?.pages[0]?.id ?? null,
			selectedModuleId: null,
		});
	},
	setMode: (mode) => set({ mode }),
	setSelectedModuleId: (selectedModuleId) => set({ selectedModuleId }),
	setPaletteDrag: (paletteDrag) => set({ paletteDrag }),
	setActivePageId: (activePageId) =>
		set({ activePageId, selectedModuleId: null }),
	addPage: async (name) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const nextPage = createDefaultSheetPage(
			name || `Page ${activeSheet.pages.length + 1}`,
		);
		const nextDocument = updateMeta({
			...activeSheet,
			pages: [...activeSheet.pages, nextPage],
		});
		const nextSheets = await persistDocument(nextDocument);
		set({
			activeSheet: nextDocument,
			activePageId: nextPage.id,
			sheets: nextSheets,
			selectedModuleId: null,
		});
	},
	renamePage: async (pageId, name) => {
		const { activeSheet } = get();
		const trimmed = name.trim();
		if (!activeSheet || !trimmed) return;
		const nextDocument = updateMeta(
			replaceSheetPage(activeSheet, pageId, (page) => ({
				...page,
				name: trimmed,
			})),
		);
		const nextSheets = await persistDocument(nextDocument);
		set({ activeSheet: nextDocument, sheets: nextSheets });
	},
	deletePage: async (pageId) => {
		const { activeSheet, activePageId } = get();
		if (!activeSheet || activeSheet.pages.length <= 1) return;
		const remainingPages = activeSheet.pages.filter(
			(page) => page.id !== pageId,
		);
		const nextDocument = updateMeta({
			...activeSheet,
			pages: remainingPages,
		});
		const nextSheets = await persistDocument(nextDocument);
		set({
			activeSheet: nextDocument,
			activePageId:
				activePageId === pageId
					? (remainingPages[0]?.id ?? null)
					: activePageId,
			sheets: nextSheets,
			selectedModuleId: null,
		});
	},
	replaceActiveSheetLocal: (document) => set({ activeSheet: document }),
	saveActiveSheet: async () => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const repaired = repairSheetDocument(activeSheet);
		const nextSheets = await persistDocument(repaired);
		set({ activeSheet: repaired, sheets: nextSheets });
	},
	addModule: async (type, position) => {
		const { activeSheet, activePageId } = get();
		if (!activeSheet) return;
		const page = getSheetPage(activeSheet, activePageId);
		const module = createModule(type);
		if ("fieldKey" in module.props) {
			module.props.fieldKey = makeUniqueFieldKey(
				activeSheet,
				module.props.fieldKey,
			);
		}
		const placed = findPlacement(page, activeSheet.grid, module, position);
		if (!placed) {
			toast.error("No space left on this page for that module.");
			return;
		}
		const nextDocument = updateMeta(
			replaceSheetPage(activeSheet, page.id, (currentPage) => ({
				...currentPage,
				modules: [...currentPage.modules, placed],
			})),
		);
		const nextSheets = await persistDocument(nextDocument);
		set({
			activeSheet: nextDocument,
			sheets: nextSheets,
			selectedModuleId: placed.id,
			activePageId: page.id,
		});
	},
	updateModule: async (moduleId, updater) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		let changed = false;
		const nextDocument = updateMeta({
			...activeSheet,
			pages: activeSheet.pages.map((page) => ({
				...page,
				modules: page.modules.map((module) => {
					if (module.id !== moduleId) return module;
					changed = true;
					return updater(module);
				}),
			})),
		});
		if (!changed) return;
		const nextSheets = await persistDocument(nextDocument);
		set({ activeSheet: nextDocument, sheets: nextSheets });
	},
	deleteModule: async (moduleId) => {
		const { activeSheet, selectedModuleId } = get();
		if (!activeSheet) return;
		const nextDocument = updateMeta({
			...activeSheet,
			pages: activeSheet.pages.map((page) => ({
				...page,
				modules: page.modules.filter((module) => module.id !== moduleId),
			})),
		});
		const nextSheets = await persistDocument(nextDocument);
		set({
			activeSheet: nextDocument,
			sheets: nextSheets,
			selectedModuleId: selectedModuleId === moduleId ? null : selectedModuleId,
		});
	},
	updateGrid: async (grid) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const nextDocument = repairSheetDocument(
			updateMeta({
				...activeSheet,
				grid,
				pages: activeSheet.pages.map((page) => ({
					...page,
					modules: transformModulesForGrid(
						page.modules,
						activeSheet.grid,
						grid,
					),
				})),
			}),
		);
		const nextSheets = await persistDocument(nextDocument);
		set({ activeSheet: nextDocument, sheets: nextSheets });
	},
	setFieldValue: async (fieldKey, value) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const nextDocument = updateMeta({
			...activeSheet,
			values: {
				...activeSheet.values,
				[fieldKey]: value,
			},
		});
		const nextSheets = await persistDocument(nextDocument);
		set({ activeSheet: nextDocument, sheets: nextSheets });
	},
}));

export function getResolutionById(id: string) {
	return (
		SHEET_RESOLUTIONS.find((item) => item.id === id) ?? SHEET_RESOLUTIONS[1]
	);
}
