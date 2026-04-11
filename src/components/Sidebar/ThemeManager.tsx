import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Palette, Upload } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

export default function ThemeManager() {
	const {
		color,
		setColor,
		customThemes,
		addCustomTheme,
		removeCustomTheme,
		allThemes,
	} = useTheme();
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingTheme, setEditingTheme] = useState(
		customThemes.find((t) => t.id === color) ?? { id: "", name: "", css: "" },
	);

	// 1. Tauri Native File Picker Import
	const handleImportFile = async () => {
		try {
			const selectedPath = await open({
				title: "Import Custom Theme",
				multiple: false,
				filters: [{ name: "CSS Files", extensions: ["css"] }],
			});

			if (selectedPath && typeof selectedPath === "string") {
				// Read file from disk
				const cssContent = await readTextFile(selectedPath);

				// Extract file name without extension to use as the Theme Name
				const fileName =
					selectedPath.split(/[\\/]/).pop()?.replace(".css", "") ||
					"Imported Theme";
				const themeId = `custom-${Date.now()}`;

				addCustomTheme({
					id: themeId,
					name: fileName,
					css: cssContent,
				});

				setColor(themeId); // Auto-apply it
			}
		} catch (error) {
			console.error("Failed to import theme:", error);
		}
	};

	const handleSaveDraft = () => {
		if (!editingTheme.name.trim()) return;

		const id =
			editingTheme.id === "" ? `custom-${Date.now()}` : editingTheme.id;
		addCustomTheme({ id, name: editingTheme.name, css: editingTheme.css });
		setColor(id);
		setIsEditorOpen(false);
	};

	return (
		<div className="min-h-9 p-2 my-2 flex flex-col justify-between space-y-2">
			<Label className="text-xs font-mono uppercase tracking-widest opacity-50">
				Theme Management
			</Label>
			<Select
				items={allThemes}
				value={color}
				onValueChange={(value) => {
					if (value) setColor(value);
					const theme = customThemes.find((t) => t.id === value);
					if (theme) setEditingTheme(theme);
				}}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Select a theme" />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					{allThemes.map((palette) => (
						<SelectItem key={palette.value} value={palette.value}>
							{palette.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<div className="flex w-full gap-2">
				<Button
					className="flex-1"
					variant="secondary"
					onClick={handleImportFile}
				>
					<Upload className="w-4 h-4" /> Import
				</Button>

				{/* Large Editor Modal */}
				<Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
					<Button
						className="flex-1"
						variant="outline"
						onClick={() => setIsEditorOpen(true)}
					>
						<Palette className="w-4 h-4" /> Editor
					</Button>
					<DialogContent className="max-w-4xl h-[80vh] min-w-[50vw] flex flex-col">
						<DialogHeader>
							<DialogTitle className="underline underline-offset-8">
								Custom Theme Editor
							</DialogTitle>
						</DialogHeader>

						<div className="flex flex-col gap-4 flex-1 p-1 overflow-hidden">
							<Input
								placeholder="Theme Name (e.g. Midnight Blue)"
								value={editingTheme.name}
								onChange={(e) =>
									setEditingTheme({ ...editingTheme, name: e.target.value })
								}
							/>
							<Textarea
								className="font-mono text-xs flex-1 bg-card/50 resize-none p-4"
								placeholder={`:root.theme-custom {\n  --background: oklch(0.98 0 0);\n  --foreground: oklch(0.1 0 0);\n}\n.dark.theme-custom {\n  --background: oklch(0.1 0 0);\n  --foreground: oklch(0.98 0 0);\n}`}
								value={editingTheme.css}
								onChange={(e) =>
									setEditingTheme({ ...editingTheme, css: e.target.value })
								}
							/>
						</div>
						<DialogFooter>
							<div className="flex justify-end gap-2 pt-2">
								<Button variant="ghost" onClick={() => setIsEditorOpen(false)}>
									Cancel
								</Button>
								<Button
									onClick={handleSaveDraft}
									disabled={
										!editingTheme.name.trim() || !editingTheme.css.trim()
									}
								>
									Save Theme
								</Button>
							</div>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
