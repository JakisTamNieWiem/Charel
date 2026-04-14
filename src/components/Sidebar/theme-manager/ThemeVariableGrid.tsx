import { ScrollArea } from "@/components/ui/scroll-area";
import {
	THEME_VARIABLE_GROUPS,
	type ThemeMode,
	type ThemeVariableMap,
} from "@/lib/theme-editor";
import { ThemeVariableField } from "./ThemeVariableField";

type ThemeVariableGridProps = {
	mode: ThemeMode;
	values: ThemeVariableMap;
	onChange: (mode: ThemeMode, key: string, value: string) => void;
};

const GROUP_DESCRIPTIONS: Record<string, string> = {
	core: "Base colors and surfaces.",
	charts: "Chart palette tokens.",
	sidebar: "Sidebar and nav colors.",
	typography: "Fonts and tracking.",
	layout: "Spacing and radius.",
	shadows: "Shadow tokens and layers.",
	other: "Extra theme variables.",
};

export function ThemeVariableGrid({
	mode,
	values,
	onChange,
}: ThemeVariableGridProps) {
	return (
		<ScrollArea className="h-full">
			<div className="space-y-4 pb-6 pr-4 pt-1">
				{THEME_VARIABLE_GROUPS.map((group) => (
					<section
						key={group.id}
						className="rounded-xl border border-border/70 bg-card/55 p-3.5 shadow-sm"
					>
						<div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-end sm:justify-between">
							<div className="space-y-1">
								<h3 className="text-sm font-semibold tracking-tight">
									{group.label}
								</h3>
								<p className="text-sm text-muted-foreground">
									{GROUP_DESCRIPTIONS[group.id] ?? "Theme variable controls."}
								</p>
							</div>
							<span className="inline-flex w-fit rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
								{group.keys.length} variables
							</span>
						</div>
						<div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
							{group.keys.map((key) => (
								<ThemeVariableField
									key={key}
									varKey={key}
									value={values[key] ?? ""}
									onChange={(nextValue) => onChange(mode, key, nextValue)}
								/>
							))}
						</div>
					</section>
				))}
			</div>
		</ScrollArea>
	);
}
