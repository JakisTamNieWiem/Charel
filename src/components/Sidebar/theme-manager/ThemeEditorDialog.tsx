import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThemeMode, ThemeValues } from "@/lib/theme-editor";
import { ThemeVariableGrid } from "./ThemeVariableGrid";

type ThemeEditorDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	themeName: string;
	onThemeNameChange: (name: string) => void;
	values: ThemeValues;
	rawCss: string;
	onRawCssChange: (css: string) => void;
	onVariableChange: (mode: ThemeMode, key: string, value: string) => void;
	onSave: () => void;
	onOpenThemesFolder: () => void;
	saveDisabled: boolean;
};

export function ThemeEditorDialog({
	open,
	onOpenChange,
	themeName,
	onThemeNameChange,
	values,
	rawCss,
	onRawCssChange,
	onVariableChange,
	onSave,
	onOpenThemesFolder,
	saveDisabled,
}: ThemeEditorDialogProps) {
	const tokenCount = Object.keys(values.light).length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[84vh] min-w-[72vw] max-w-6xl flex-col overflow-hidden border-border/70 bg-background p-0 shadow-2xl">
				<DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-5">
					<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
						<div className="w-full max-w-xl space-y-3">
							<DialogTitle className="text-xl tracking-tight">
								Custom Theme Editor
							</DialogTitle>
							<div className="flex items-center justify-between gap-3">
								<p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
									Theme Name
								</p>
								<span className="text-xs text-muted-foreground">
									Saved as custom CSS
								</span>
							</div>
							<Input
								placeholder="Midnight Blue"
								value={themeName}
								onChange={(event) => onThemeNameChange(event.target.value)}
								className="h-10 bg-background/80"
							/>
						</div>

						<div className="grid gap-2 sm:grid-cols-2 xl:w-sm xl:shrink-0 self-end">
							<div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
								<p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
									Coverage
								</p>
								<p className="mt-1 text-sm font-medium">
									{tokenCount} variables
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={onOpenThemesFolder}
								className="h-full min-h-14 justify-between rounded-lg border-border/70 bg-background/80 px-3 py-2 text-left"
							>
								<div className="space-y-1">
									<p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
										Output
									</p>
									<p className="text-sm font-medium">Open themes folder</p>
								</div>
								<FolderOpen className="h-4 w-4 shrink-0" />
							</Button>
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-hidden px-6">
					<Tabs defaultValue="light" className="flex h-full min-h-0 flex-col">
						<TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
							<TabsTrigger value="light">Light tokens</TabsTrigger>
							<TabsTrigger value="dark">Dark tokens</TabsTrigger>
							<TabsTrigger value="raw">Raw CSS</TabsTrigger>
						</TabsList>

						<TabsContent
							value="light"
							className="mt-2 min-h-0 flex-1 overflow-hidden outline-none"
						>
							<ThemeVariableGrid
								mode="light"
								values={values.light}
								onChange={onVariableChange}
							/>
						</TabsContent>

						<TabsContent
							value="dark"
							className="mt-2 min-h-0 flex-1 overflow-hidden outline-none"
						>
							<ThemeVariableGrid
								mode="dark"
								values={values.dark}
								onChange={onVariableChange}
							/>
						</TabsContent>

						<TabsContent
							value="raw"
							className="mt-2 min-h-0 flex-1 overflow-hidden"
						>
							<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/55">
								<div className="border-b border-border/70 px-4 py-3">
									<p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
										Raw Theme CSS
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										Use this when you want to paste or fine-tune the generated
										`:root.theme-custom` and `.dark.theme-custom` blocks.
									</p>
								</div>
								<textarea
									className="h-full min-h-0 w-full resize-none overflow-auto bg-transparent px-4 py-4 font-mono text-xs leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
									value={rawCss}
									onChange={(event) => onRawCssChange(event.target.value)}
								/>
							</div>
						</TabsContent>
					</Tabs>
				</div>

				<DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4">
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={onSave} disabled={saveDisabled}>
							Save Theme
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
