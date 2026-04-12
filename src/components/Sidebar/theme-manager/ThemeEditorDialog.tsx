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
import { Textarea } from "@/components/ui/textarea";
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
	saveDisabled,
}: ThemeEditorDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[85vh] min-w-[70vw] max-w-5xl flex-col overflow-hidden p-0">
				<DialogHeader className="p-6 pb-2">
					<DialogTitle className="underline underline-offset-8">
						Custom Theme Editor
					</DialogTitle>
				</DialogHeader>

				<div className="px-6">
					<Input
						placeholder="Theme Name (e.g. Midnight Blue)"
						value={themeName}
						onChange={(event) => onThemeNameChange(event.target.value)}
						className="max-w-sm"
					/>
				</div>

				<div className="flex-1 overflow-hidden px-6 pb-2">
					<Tabs defaultValue="light" className="flex h-full flex-col">
						<TabsList>
							<TabsTrigger value="light">Light Mode Variables</TabsTrigger>
							<TabsTrigger value="dark">Dark Mode Variables</TabsTrigger>
							<TabsTrigger value="raw">Raw CSS Fallback</TabsTrigger>
						</TabsList>

						<TabsContent
							value="light"
							className="mt-2 flex-1 overflow-hidden outline-none"
						>
							<ThemeVariableGrid
								mode="light"
								values={values.light}
								onChange={onVariableChange}
							/>
						</TabsContent>

						<TabsContent
							value="dark"
							className="mt-2 flex-1 overflow-hidden outline-none"
						>
							<ThemeVariableGrid
								mode="dark"
								values={values.dark}
								onChange={onVariableChange}
							/>
						</TabsContent>

						<TabsContent value="raw" className="mt-2 flex-1">
							<Textarea
								className="h-full w-full resize-none bg-card/50 p-4 font-mono text-xs"
								value={rawCss}
								onChange={(event) => onRawCssChange(event.target.value)}
							/>
						</TabsContent>
					</Tabs>
				</div>

				<DialogFooter className="border-t bg-muted/20 p-6 pt-4">
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
