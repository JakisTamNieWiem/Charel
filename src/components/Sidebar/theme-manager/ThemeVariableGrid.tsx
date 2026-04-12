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

export function ThemeVariableGrid({
	mode,
	values,
	onChange,
}: ThemeVariableGridProps) {
	return (
		<ScrollArea className="h-full pr-4">
			<div className="space-y-6 pb-6 pt-2">
				{THEME_VARIABLE_GROUPS.map((group) => (
					<section key={group.id} className="space-y-3">
						<div className="flex items-center justify-between">
							<h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
								{group.label}
							</h3>
							<span className="text-[10px] text-muted-foreground">
								{group.keys.length} vars
							</span>
						</div>
						<div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
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
