import {
	AlignLeft,
	CheckSquare,
	Gauge,
	TextCursorInput,
} from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
	BarSheetModule,
	CheckboxSheetModule,
	SheetFieldValue,
	SheetModule,
	SheetModuleType,
	TextareaSheetModule,
	TextSheetModule,
} from "@/types/sheets";

export interface SheetModuleRenderContext {
	mode: "edit" | "view";
	values: Record<string, SheetFieldValue>;
	onValueChange: (fieldKey: string, value: SheetFieldValue) => void;
}

export interface SheetBlockDefinition {
	type: SheetModuleType;
	label: string;
	description: string;
	icon: ReactNode;
	minW: number;
	minH: number;
	render: (
		module: SheetModule,
		context: SheetModuleRenderContext,
	) => ReactNode;
}

function toDisplayValue(value: SheetFieldValue | undefined) {
	if (typeof value === "boolean") return value ? "True" : "False";
	if (value === undefined || value === null) return "";
	return String(value);
}

function renderTextModule(
	module: TextSheetModule,
	context: SheetModuleRenderContext,
) {
	const isDerived = Boolean(module.props.formula.trim());
	const value = context.values[module.props.fieldKey];
	return (
		<div className="flex h-full flex-col gap-2">
			<div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
				{module.props.label || "Text Field"}
			</div>
			<Input
				value={toDisplayValue(value)}
				readOnly={context.mode === "edit" || isDerived}
				placeholder={module.props.placeholder}
				onChange={(event) =>
					context.onValueChange(module.props.fieldKey, event.target.value)
				}
				className={cn(
					"h-10 bg-background/70",
					isDerived && "font-mono",
				)}
			/>
			{isDerived && (
				<div className="text-[11px] text-muted-foreground">
					Formula: <span className="font-mono">{module.props.formula}</span>
				</div>
			)}
		</div>
	);
}

function renderTextareaModule(
	module: TextareaSheetModule,
	context: SheetModuleRenderContext,
) {
	const isDerived = Boolean(module.props.formula.trim());
	const value = context.values[module.props.fieldKey];
	return (
		<div className="flex h-full flex-col gap-2">
			<div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
				{module.props.label || "Text Area"}
			</div>
			<Textarea
				value={toDisplayValue(value)}
				readOnly={context.mode === "edit" || isDerived}
				placeholder={module.props.placeholder}
				onChange={(event) =>
					context.onValueChange(module.props.fieldKey, event.target.value)
				}
				className="min-h-0 flex-1 resize-none bg-background/70"
			/>
			{isDerived && (
				<div className="text-[11px] text-muted-foreground">
					Formula: <span className="font-mono">{module.props.formula}</span>
				</div>
			)}
		</div>
	);
}

function renderCheckboxModule(
	module: CheckboxSheetModule,
	context: SheetModuleRenderContext,
) {
	const checked = Boolean(context.values[module.props.fieldKey]);
	return (
		<div className="flex h-full items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2">
			<div className="min-w-0">
				<div className="truncate text-sm font-medium">
					{module.props.label || "Checkbox"}
				</div>
				<div className="text-[11px] text-muted-foreground">
					{module.props.fieldKey}
				</div>
			</div>
			<Switch
				checked={checked}
				disabled={context.mode === "edit"}
				onCheckedChange={(nextChecked) =>
					context.onValueChange(module.props.fieldKey, nextChecked)
				}
			/>
		</div>
	);
}

function renderBarModule(
	module: BarSheetModule,
	context: SheetModuleRenderContext,
) {
	const current = Number(context.values[module.props.currentFieldKey] ?? 0);
	const max = Number(context.values[module.props.maxFieldKey] ?? 0);
	const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	return (
		<div className="flex h-full flex-col justify-center gap-2">
			<div className="flex items-center justify-between gap-3 text-sm font-medium">
				<span>{module.props.label || "Progress"}</span>
				{module.props.showValues && (
					<span className="font-mono text-xs text-muted-foreground">
						{current}/{max || 0}
					</span>
				)}
			</div>
			<div className="h-4 overflow-hidden rounded-full border border-border/80 bg-muted/60">
				<div
					className="h-full rounded-full bg-primary transition-[width]"
					style={{ width: `${percent}%` }}
				/>
			</div>
			<div className="text-[11px] text-muted-foreground">
				Linked: <span className="font-mono">{module.props.currentFieldKey || "current"}</span>
				{" / "}
				<span className="font-mono">{module.props.maxFieldKey || "max"}</span>
			</div>
		</div>
	);
}

export const SHEET_BLOCKS: SheetBlockDefinition[] = [
	{
		type: "text",
		label: "Text Input",
		description: "Single-line value or derived stat",
		icon: <TextCursorInput className="size-4" />,
		minW: 2,
		minH: 2,
		render: (module, context) => renderTextModule(module as TextSheetModule, context),
	},
	{
		type: "textarea",
		label: "Text Area",
		description: "Multi-line notes block",
		icon: <AlignLeft className="size-4" />,
		minW: 3,
		minH: 3,
		render: (module, context) =>
			renderTextareaModule(module as TextareaSheetModule, context),
	},
	{
		type: "checkbox",
		label: "Checkbox",
		description: "Boolean toggle for tracked flags",
		icon: <CheckSquare className="size-4" />,
		minW: 2,
		minH: 2,
		render: (module, context) =>
			renderCheckboxModule(module as CheckboxSheetModule, context),
	},
	{
		type: "bar",
		label: "Bar",
		description: "Percentage display from linked fields",
		icon: <Gauge className="size-4" />,
		minW: 3,
		minH: 2,
		render: (module, context) => renderBarModule(module as BarSheetModule, context),
	},
];

export const SHEET_BLOCK_MAP = Object.fromEntries(
	SHEET_BLOCKS.map((block) => [block.type, block]),
) as Record<SheetModuleType, SheetBlockDefinition>;
