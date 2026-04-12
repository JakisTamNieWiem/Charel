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
	type SheetDocument,
	type SheetFieldValue,
	type SheetGridSettings,
	type SheetIndexEntry,
	type SheetModule,
	type SheetModuleType,
	type SheetViewMode,
	SHEET_RESOLUTIONS,
	createDefaultSheet,
} from "@/types/sheets";

interface SheetStoreState {
	isInitialized: boolean;
	isLoading: boolean;
	mode: SheetViewMode;
	selectedModuleId: string | null;
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
	replaceActiveSheetLocal: (document: SheetDocument) => void;
	saveActiveSheet: () => Promise<void>;
	addModule: (
		type: SheetModuleType,
		position?: Pick<SheetModule, "x" | "y">,
	) => Promise<void>;
	updateModule: (moduleId: string, updater: (module: SheetModule) => SheetModule) => Promise<void>;
	deleteModule: (moduleId: string) => Promise<void>;
	updateGrid: (grid: SheetGridSettings) => Promise<void>;
	setFieldValue: (fieldKey: string, value: SheetFieldValue) => Promise<void>;
}

const moduleDefaults: Record<
	SheetModuleType,
	{
		w: number;
		h: number;
		props: SheetModule["props"];
	}
> = {
	text: {
		w: 4,
		h: 2,
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
		props: {
			label: "Checkbox",
			fieldKey: "field_check",
			defaultChecked: false,
		},
	},
	bar: {
		w: 6,
		h: 2,
		props: {
			label: "Progress Bar",
			currentFieldKey: "",
			maxFieldKey: "",
			showValues: true,
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

function makeUniqueFieldKey(sheet: SheetDocument, base: string) {
	const existing = new Set(
		sheet.modules
			.filter((module) => "fieldKey" in module.props)
			.map((module) => ("fieldKey" in module.props ? module.props.fieldKey : "")),
	);
	let candidate = base;
	let suffix = 1;
	while (existing.has(candidate)) {
		candidate = `${base}_${suffix}`;
		suffix += 1;
	}
	return candidate;
}

function transformGrid(
	modules: SheetDocument["modules"],
	prevGrid: SheetGridSettings,
	nextGrid: SheetGridSettings,
) {
	const scaleX = nextGrid.columns / prevGrid.columns;
	const scaleY = nextGrid.rows / prevGrid.rows;
	return modules.map((module) => ({
		...module,
		x: Math.max(0, Math.min(nextGrid.columns - 1, Math.round(module.x * scaleX))),
		y: Math.max(0, Math.min(nextGrid.rows - 1, Math.round(module.y * scaleY))),
		w: Math.max(1, Math.min(nextGrid.columns, Math.round(module.w * scaleX))),
		h: Math.max(1, Math.min(nextGrid.rows, Math.round(module.h * scaleY))),
	}));
}

export const useSheetStore = create<SheetStoreState>((set, get) => ({
	isInitialized: false,
	isLoading: false,
	mode: "edit",
	selectedModuleId: null,
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
				const activeEntry = index.sheets.find((item) => item.id === index.activeSheetId);
				if (activeEntry) {
					activeSheet = await loadSheetDocument(activeEntry.fileName);
				}
			}

			set({
				sheets: index.sheets,
				activeSheetId: activeSheet?.meta.id ?? index.activeSheetId ?? null,
				activeSheet,
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
		const document = await loadSheetDocument(entry.fileName);
		const index = await loadSheetIndex();
		await saveSheetIndex({ ...index, activeSheetId: id });
		set({
			activeSheetId: id,
			activeSheet: document,
			isLoading: false,
		});
	},
	createSheet: async (name = "Untitled Sheet") => {
		const document = createDefaultSheet(name);
		const fileName = await saveSheetDocument(document);
		const entry: SheetIndexEntry = {
			...document.meta,
			fileName,
		};
		const index = await loadSheetIndex();
		const nextIndex = {
			...index,
			activeSheetId: document.meta.id,
			sheets: [...index.sheets, entry].sort((a, b) => a.name.localeCompare(b.name)),
		};
		await saveSheetIndex(nextIndex);
		set({
			sheets: nextIndex.sheets,
			activeSheetId: document.meta.id,
			activeSheet: document,
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
		const nextSheets = upsertSheetIndexEntry(index.sheets, nextEntry).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		await saveSheetIndex({ ...index, sheets: nextSheets });
		if (activeSheet?.meta.id === id) {
			const nextDocument = {
				...activeSheet,
				meta: { ...activeSheet.meta, name: trimmed, updatedAt },
			};
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
			modules: sourceDocument.modules.map((module) => ({
				...module,
				id: crypto.randomUUID(),
			})),
		};
		const fileName = await saveSheetDocument(duplicate);
		const entry: SheetIndexEntry = { ...duplicate.meta, fileName };
		const index = await loadSheetIndex();
		const nextSheets = [...index.sheets, entry].sort((a, b) => a.name.localeCompare(b.name));
		await saveSheetIndex({
			...index,
			sheets: nextSheets,
			activeSheetId: duplicate.meta.id,
		});
		set({
			sheets: nextSheets,
			activeSheetId: duplicate.meta.id,
			activeSheet: duplicate,
			selectedModuleId: null,
		});
	},
	deleteSheet: async (id) => {
		const index = await loadSheetIndex();
		const entry = index.sheets.find((item) => item.id === id);
		if (!entry) return;
		await deleteSheetDocument(entry.fileName);
		const remaining = index.sheets.filter((item) => item.id !== id);
		const nextActiveId = index.activeSheetId === id ? (remaining[0]?.id ?? null) : index.activeSheetId;
		await saveSheetIndex({
			...index,
			sheets: remaining,
			activeSheetId: nextActiveId,
		});
		let nextActiveSheet: SheetDocument | null = null;
		if (nextActiveId) {
			const nextEntry = remaining.find((item) => item.id === nextActiveId);
			if (nextEntry) {
				nextActiveSheet = await loadSheetDocument(nextEntry.fileName);
			}
		}
		set({
			sheets: remaining,
			activeSheetId: nextActiveId,
			activeSheet: nextActiveSheet,
			selectedModuleId: null,
		});
	},
	setMode: (mode) => set({ mode }),
	setSelectedModuleId: (selectedModuleId) => set({ selectedModuleId }),
	replaceActiveSheetLocal: (document) => set({ activeSheet: document }),
	saveActiveSheet: async () => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		await saveSheetDocument(activeSheet);
		const index = await loadSheetIndex();
		const nextEntry: SheetIndexEntry = {
			...activeSheet.meta,
			fileName: getSheetFileName(activeSheet.meta.id),
		};
		const nextSheets = upsertSheetIndexEntry(index.sheets, nextEntry).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		await saveSheetIndex({
			...index,
			sheets: nextSheets,
			activeSheetId: activeSheet.meta.id,
		});
		set({ sheets: nextSheets });
	},
	addModule: async (type, position) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const module = createModule(type, position?.x ?? 0, position?.y ?? 0);
		if ("fieldKey" in module.props) {
			module.props.fieldKey = makeUniqueFieldKey(activeSheet, module.props.fieldKey);
		}
		const nextDocument: SheetDocument = {
			...activeSheet,
			meta: { ...activeSheet.meta, updatedAt: new Date().toISOString() },
			modules: [...activeSheet.modules, module],
		};
		await saveSheetDocument(nextDocument);
		const index = await loadSheetIndex();
		const nextEntry: SheetIndexEntry = {
			...nextDocument.meta,
			fileName: getSheetFileName(nextDocument.meta.id),
		};
		const nextSheets = upsertSheetIndexEntry(index.sheets, nextEntry).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		await saveSheetIndex({ ...index, sheets: nextSheets, activeSheetId: nextDocument.meta.id });
		set({
			activeSheet: nextDocument,
			sheets: nextSheets,
			selectedModuleId: module.id,
		});
	},
	updateModule: async (moduleId, updater) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const nextDocument: SheetDocument = {
			...activeSheet,
			meta: { ...activeSheet.meta, updatedAt: new Date().toISOString() },
			modules: activeSheet.modules.map((module) =>
				module.id === moduleId ? updater(module) : module,
			),
		};
		await saveSheetDocument(nextDocument);
		set({ activeSheet: nextDocument });
	},
	deleteModule: async (moduleId) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const nextDocument: SheetDocument = {
			...activeSheet,
			meta: { ...activeSheet.meta, updatedAt: new Date().toISOString() },
			modules: activeSheet.modules.filter((module) => module.id !== moduleId),
		};
		await saveSheetDocument(nextDocument);
		set({
			activeSheet: nextDocument,
			selectedModuleId: get().selectedModuleId === moduleId ? null : get().selectedModuleId,
		});
	},
	updateGrid: async (grid) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const nextDocument: SheetDocument = {
			...activeSheet,
			meta: { ...activeSheet.meta, updatedAt: new Date().toISOString() },
			grid,
			modules: transformGrid(activeSheet.modules, activeSheet.grid, grid),
		};
		await saveSheetDocument(nextDocument);
		set({ activeSheet: nextDocument });
	},
	setFieldValue: async (fieldKey, value) => {
		const { activeSheet } = get();
		if (!activeSheet) return;
		const nextDocument: SheetDocument = {
			...activeSheet,
			meta: { ...activeSheet.meta, updatedAt: new Date().toISOString() },
			values: {
				...activeSheet.values,
				[fieldKey]: value,
			},
		};
		await saveSheetDocument(nextDocument);
		set({ activeSheet: nextDocument });
	},
}));

export function getResolutionById(id: string) {
	return SHEET_RESOLUTIONS.find((item) => item.id === id) ?? SHEET_RESOLUTIONS[1];
}
