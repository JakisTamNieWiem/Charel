export type SheetViewMode = "edit" | "view";

export type SheetModuleType =
	| "text"
	| "textarea"
	| "checkbox"
	| "bar"
	| "number"
	| "heading"
	| "divider";

export type SheetFieldValue = string | number | boolean;

export interface SheetGridSettings {
	columns: number;
	rows: number;
	cellSize: number;
	resolutionId: string;
}

export interface SheetDocumentMeta {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

export interface SheetPage {
	id: string;
	name: string;
	modules: SheetModule[];
}

export interface BaseSheetModule<TType extends SheetModuleType, TProps> {
	id: string;
	type: TType;
	x: number;
	y: number;
	w: number;
	h: number;
	props: TProps;
}

export interface TextModuleProps {
	label: string;
	fieldKey: string;
	placeholder: string;
	defaultValue: string;
	formula: string;
}

export interface TextareaModuleProps {
	label: string;
	fieldKey: string;
	placeholder: string;
	defaultValue: string;
	formula: string;
}

export interface CheckboxModuleProps {
	label: string;
	fieldKey: string;
	defaultChecked: boolean;
}

export interface BarModuleProps {
	label: string;
	currentFieldKey: string;
	maxFieldKey: string;
	showValues: boolean;
}

export interface NumberModuleProps {
	label: string;
	fieldKey: string;
	defaultValue: string;
	formula: string;
	prefix: string;
	suffix: string;
}

export interface HeadingModuleProps {
	title: string;
	subtitle: string;
	align: "start" | "center";
}

export interface DividerModuleProps {
	label: string;
	style: "solid" | "dashed" | "ornate";
}

export type TextSheetModule = BaseSheetModule<"text", TextModuleProps>;
export type TextareaSheetModule = BaseSheetModule<
	"textarea",
	TextareaModuleProps
>;
export type CheckboxSheetModule = BaseSheetModule<
	"checkbox",
	CheckboxModuleProps
>;
export type BarSheetModule = BaseSheetModule<"bar", BarModuleProps>;
export type NumberSheetModule = BaseSheetModule<"number", NumberModuleProps>;
export type HeadingSheetModule = BaseSheetModule<"heading", HeadingModuleProps>;
export type DividerSheetModule = BaseSheetModule<"divider", DividerModuleProps>;

export type SheetModule =
	| TextSheetModule
	| TextareaSheetModule
	| CheckboxSheetModule
	| BarSheetModule
	| NumberSheetModule
	| HeadingSheetModule
	| DividerSheetModule;

export interface SheetDocument {
	version: "2";
	meta: SheetDocumentMeta;
	grid: SheetGridSettings;
	pages: SheetPage[];
	values: Record<string, SheetFieldValue>;
}

export interface SheetIndexEntry extends SheetDocumentMeta {
	fileName: string;
}

export interface SheetIndexFile {
	version: "1";
	activeSheetId: string | null;
	sheets: SheetIndexEntry[];
}

export interface SheetFormulaIssue {
	fieldKey: string;
	message: string;
}

export interface EvaluatedSheetState {
	values: Record<string, SheetFieldValue>;
	issues: SheetFormulaIssue[];
}

export const SHEET_RESOLUTIONS: Array<{
	id: string;
	label: string;
	columns: number;
	rows: number;
	cellSize: number;
}> = [
	{ id: "cozy", label: "Cozy", columns: 12, rows: 17, cellSize: 44 },
	{ id: "balanced", label: "Balanced", columns: 16, rows: 23, cellSize: 34 },
	{ id: "dense", label: "Dense", columns: 20, rows: 29, cellSize: 28 },
];

export const DEFAULT_SHEET_RESOLUTION = SHEET_RESOLUTIONS[1];

export function createDefaultSheetPage(name = "Page 1"): SheetPage {
	return {
		id: crypto.randomUUID(),
		name,
		modules: [],
	};
}

export function createDefaultSheet(name: string): SheetDocument {
	const now = new Date().toISOString();
	return {
		version: "2",
		meta: {
			id: crypto.randomUUID(),
			name,
			createdAt: now,
			updatedAt: now,
		},
		grid: {
			columns: DEFAULT_SHEET_RESOLUTION.columns,
			rows: DEFAULT_SHEET_RESOLUTION.rows,
			cellSize: DEFAULT_SHEET_RESOLUTION.cellSize,
			resolutionId: DEFAULT_SHEET_RESOLUTION.id,
		},
		pages: [createDefaultSheetPage()],
		values: {},
	};
}

export function getAllSheetModules(document: SheetDocument) {
	return document.pages.flatMap((page) => page.modules);
}

export function getSheetPage(
	document: SheetDocument,
	pageId: string | null | undefined,
) {
	if (!document.pages.length) {
		return createDefaultSheetPage();
	}
	return document.pages.find((page) => page.id === pageId) ?? document.pages[0];
}

export function replaceSheetPage(
	document: SheetDocument,
	pageId: string,
	updater: (page: SheetPage) => SheetPage,
): SheetDocument {
	return {
		...document,
		pages: document.pages.map((page) =>
			page.id === pageId ? updater(page) : page,
		),
	};
}

export function isFieldModule(
	module: SheetModule,
): module is
	| TextSheetModule
	| TextareaSheetModule
	| CheckboxSheetModule
	| NumberSheetModule {
	return (
		module.type === "text" ||
		module.type === "textarea" ||
		module.type === "checkbox" ||
		module.type === "number"
	);
}
