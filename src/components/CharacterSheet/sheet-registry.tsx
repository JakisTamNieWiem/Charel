import {
	AlignLeft,
	Check,
	CheckSquare,
	Gauge,
	Heading1,
	Minus,
	Sigma,
	TextCursorInput,
} from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
	BarSheetModule,
	CheckboxSheetModule,
	DividerSheetModule,
	HeadingSheetModule,
	NumberSheetModule,
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
	render: (module: SheetModule, context: SheetModuleRenderContext) => ReactNode;
}

function toDisplayValue(value: SheetFieldValue | undefined) {
	if (typeof value === "boolean") return value ? "true" : "false";
	if (value === undefined || value === null) return "";
	return String(value);
}

function FieldChrome({
	label,
	fieldKey,
	children,
	className,
}: {
	label: string;
	fieldKey?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative flex h-full flex-col justify-between px-1 py-1.5",
				className,
			)}
		>
			<div className="mb-2 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
						{label}
					</div>
					{fieldKey ? (
						<div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/60">
							{fieldKey}
						</div>
					) : null}
				</div>
				<div className="mt-1 h-px w-8 shrink-0 bg-border/40" />
			</div>
			{children}
		</div>
	);
}

function renderTextModule(
	module: TextSheetModule,
	context: SheetModuleRenderContext,
) {
	const isDerived = Boolean(module.props.formula.trim());
	return (
		<FieldChrome
			label={module.props.label || "Field"}
			fieldKey={module.props.fieldKey}
		>
			<div className="flex flex-1 flex-col justify-end">
				<Input
					value={toDisplayValue(context.values[module.props.fieldKey])}
					readOnly={context.mode === "edit" || isDerived}
					placeholder={module.props.placeholder}
					onChange={(event) =>
						context.onValueChange(module.props.fieldKey, event.target.value)
					}
					className={cn(
						"h-9 rounded-none border-x-0 border-t-0 border-b border-border/70 bg-transparent px-0 text-base shadow-none focus-visible:border-foreground/40 focus-visible:ring-0",
						isDerived && "font-mono text-lg tracking-wide",
					)}
				/>
				{isDerived ? (
					<div className="mt-2 text-[10px] text-muted-foreground">
						Derived from{" "}
						<span className="font-mono">{module.props.formula}</span>
					</div>
				) : null}
			</div>
		</FieldChrome>
	);
}

function renderTextareaModule(
	module: TextareaSheetModule,
	context: SheetModuleRenderContext,
) {
	const isDerived = Boolean(module.props.formula.trim());
	return (
		<FieldChrome
			label={module.props.label || "Notes"}
			fieldKey={module.props.fieldKey}
		>
			<Textarea
				value={toDisplayValue(context.values[module.props.fieldKey])}
				readOnly={context.mode === "edit" || isDerived}
				placeholder={module.props.placeholder}
				onChange={(event) =>
					context.onValueChange(module.props.fieldKey, event.target.value)
				}
				className="min-h-0 flex-1 resize-none rounded-none border-x-0 border-y-0 border-b border-border/70 bg-[linear-gradient(to_bottom,transparent_0,transparent_24px,color-mix(in_srgb,var(--border)_30%,transparent)_25px)] px-0 py-0 leading-[25px] shadow-none focus-visible:border-foreground/40 focus-visible:ring-0"
			/>
		</FieldChrome>
	);
}

function renderCheckboxModule(
	module: CheckboxSheetModule,
	context: SheetModuleRenderContext,
) {
	const checked = Boolean(context.values[module.props.fieldKey]);
	return (
		<FieldChrome
			label={module.props.label || "Toggle"}
			fieldKey={module.props.fieldKey}
			className="justify-center"
		>
			<button
				type="button"
				disabled={context.mode === "edit"}
				onClick={() => context.onValueChange(module.props.fieldKey, !checked)}
				className={cn(
					"flex items-center gap-3 px-1 py-1 text-left transition-colors",
					context.mode === "view" && "hover:text-foreground",
				)}
			>
				<span
					className={cn(
						"flex size-5 items-center justify-center border text-transparent transition-colors",
						checked
							? "border-primary/80 bg-primary/90 text-primary-foreground"
							: "border-border/80 bg-transparent",
					)}
				>
					<Check className="size-4" />
				</span>
				<span className="text-sm text-foreground/90">
					{checked ? "Checked" : "Unchecked"}
				</span>
			</button>
		</FieldChrome>
	);
}

function renderBarModule(
	module: BarSheetModule,
	context: SheetModuleRenderContext,
) {
	const current = Number(context.values[module.props.currentFieldKey] ?? 0);
	const max = Number(context.values[module.props.maxFieldKey] ?? 0);
	const percent =
		max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
	return (
		<FieldChrome label={module.props.label || "Meter"}>
			<div className="flex flex-1 flex-col justify-end gap-2">
				<div className="flex items-end justify-between gap-3">
					<div className="text-3xl leading-none font-semibold tabular-nums">
						{Math.round(percent)}%
					</div>
					{module.props.showValues ? (
						<div className="font-mono text-xs text-muted-foreground">
							{current}/{max || 0}
						</div>
					) : null}
				</div>
				<div className="h-3 overflow-hidden rounded-none border border-border/60 bg-transparent">
					<div
						className="h-full bg-linear-to-r from-primary/70 via-primary to-primary transition-[width]"
						style={{ width: `${percent}%` }}
					/>
				</div>
				<div className="text-[10px] text-muted-foreground">
					Linked fields:{" "}
					<span className="font-mono">
						{module.props.currentFieldKey || "current"}
					</span>
					{" / "}
					<span className="font-mono">{module.props.maxFieldKey || "max"}</span>
				</div>
			</div>
		</FieldChrome>
	);
}

function renderNumberModule(
	module: NumberSheetModule,
	context: SheetModuleRenderContext,
) {
	const isDerived = Boolean(module.props.formula.trim());
	const value = toDisplayValue(context.values[module.props.fieldKey]);
	return (
		<FieldChrome
			label={module.props.label || "Number"}
			fieldKey={module.props.fieldKey}
			className="items-center text-center"
		>
			<div className="flex flex-1 flex-col items-center justify-center gap-2">
				<div className="flex items-end justify-center gap-1">
					{module.props.prefix ? (
						<span className="pb-1 text-sm text-muted-foreground">
							{module.props.prefix}
						</span>
					) : null}
					<Input
						type="number"
						value={value}
						readOnly={context.mode === "edit" || isDerived}
						onChange={(event) =>
							context.onValueChange(module.props.fieldKey, event.target.value)
						}
						className="h-auto w-full max-w-[6rem] rounded-none border-0 bg-transparent px-0 text-center text-5xl leading-none font-semibold shadow-none focus-visible:ring-0"
					/>
					{module.props.suffix ? (
						<span className="pb-1 text-sm text-muted-foreground">
							{module.props.suffix}
						</span>
					) : null}
				</div>
				<div className="h-px w-14 bg-border/70" />
				{isDerived ? (
					<div className="text-[10px] text-muted-foreground">
						Formula: <span className="font-mono">{module.props.formula}</span>
					</div>
				) : null}
			</div>
		</FieldChrome>
	);
}

function renderHeadingModule(module: HeadingSheetModule) {
	return (
		<div
			className={cn(
				"flex h-full flex-col justify-center gap-1 border-b border-border/55 pb-2",
				module.props.align === "center" && "items-center text-center",
			)}
		>
			<div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground/80">
				Section
			</div>
			<h3 className="serif text-[1.7rem] font-semibold tracking-tight">
				{module.props.title || "Section Heading"}
			</h3>
			{module.props.subtitle ? (
				<p className="max-w-[28ch] text-sm text-muted-foreground">
					{module.props.subtitle}
				</p>
			) : null}
		</div>
	);
}

function renderDividerModule(module: DividerSheetModule) {
	return (
		<div className="flex h-full items-center gap-3 px-1">
			<div
				className={cn(
					"h-px flex-1 bg-border/55",
					module.props.style === "dashed" &&
						"bg-none border-t border-dashed border-border/80",
				)}
			/>
			{module.props.label ? (
				<span className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
					{module.props.label}
				</span>
			) : null}
			{module.props.style === "ornate" ? (
				<span className="text-muted-foreground">✦</span>
			) : null}
			<div
				className={cn(
					"h-px flex-1 bg-border/80",
					module.props.style === "dashed" &&
						"bg-none border-t border-dashed border-border/80",
				)}
			/>
		</div>
	);
}

export const SHEET_BLOCKS: SheetBlockDefinition[] = [
	{
		type: "heading",
		label: "Heading",
		description: "Section title and subtitle",
		icon: <Heading1 className="size-4" />,
		minW: 4,
		minH: 2,
		render: (module) => renderHeadingModule(module as HeadingSheetModule),
	},
	{
		type: "divider",
		label: "Divider",
		description: "Rhythm break between groups",
		icon: <Minus className="size-4" />,
		minW: 4,
		minH: 1,
		render: (module) => renderDividerModule(module as DividerSheetModule),
	},
	{
		type: "text",
		label: "Line Field",
		description: "Underlined single-line entry",
		icon: <TextCursorInput className="size-4" />,
		minW: 2,
		minH: 2,
		render: (module, context) =>
			renderTextModule(module as TextSheetModule, context),
	},
	{
		type: "number",
		label: "Number Stat",
		description: "Large score or derived modifier",
		icon: <Sigma className="size-4" />,
		minW: 2,
		minH: 3,
		render: (module, context) =>
			renderNumberModule(module as NumberSheetModule, context),
	},
	{
		type: "textarea",
		label: "Notes",
		description: "Lined note block",
		icon: <AlignLeft className="size-4" />,
		minW: 3,
		minH: 3,
		render: (module, context) =>
			renderTextareaModule(module as TextareaSheetModule, context),
	},
	{
		type: "checkbox",
		label: "Checkbox",
		description: "Stamped checkbox row",
		icon: <CheckSquare className="size-4" />,
		minW: 2,
		minH: 2,
		render: (module, context) =>
			renderCheckboxModule(module as CheckboxSheetModule, context),
	},
	{
		type: "bar",
		label: "Meter",
		description: "Linked progress or resource bar",
		icon: <Gauge className="size-4" />,
		minW: 3,
		minH: 2,
		render: (module, context) =>
			renderBarModule(module as BarSheetModule, context),
	},
];

export const SHEET_BLOCK_MAP = Object.fromEntries(
	SHEET_BLOCKS.map((block) => [block.type, block]),
) as Record<SheetModuleType, SheetBlockDefinition>;
