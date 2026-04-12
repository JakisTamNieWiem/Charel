import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Palette, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { type CustomTheme, useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	applyThemePreview,
	clearThemePreview,
	getPresetThemeValues,
	normalizeThemeValues,
	parseThemeCss,
	serializeThemeCss,
	type ThemeMode,
	type ThemeValues,
} from "@/lib/theme-editor";
import { ThemeEditorDialog } from "./theme-manager/ThemeEditorDialog";

type ThemeDraft = {
	id: string;
	name: string;
	values: ThemeValues;
};

function buildThemeDraft(
	color: string,
	allThemes: ReturnType<typeof useTheme>["allThemes"],
	customThemes: CustomTheme[],
): ThemeDraft {
	const selectedCustomTheme = customThemes.find((theme) => theme.id === color);

	if (selectedCustomTheme) {
		return {
			id: selectedCustomTheme.id,
			name: selectedCustomTheme.name,
			values: normalizeThemeValues(parseThemeCss(selectedCustomTheme.css)),
		};
	}

	const selectedThemeOption = allThemes.find((theme) => theme.value === color);

	return {
		id: "",
		name: selectedThemeOption
			? `${selectedThemeOption.label} Copy`
			: "Custom Theme",
		values: getPresetThemeValues(color),
	};
}

export default function ThemeManager() {
	const { color, setColor, customThemes, addCustomTheme, allThemes } =
		useTheme();
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [draft, setDraft] = useState<ThemeDraft>(() =>
		buildThemeDraft(color, allThemes, customThemes),
	);
	const [rawCss, setRawCss] = useState(() => serializeThemeCss(draft.values));

	useEffect(() => {
		if (!isEditorOpen) {
			clearThemePreview();
			return;
		}

		applyThemePreview(draft.values);

		return () => clearThemePreview();
	}, [draft.values, isEditorOpen]);

	const openEditor = () => {
		const nextDraft = buildThemeDraft(color, allThemes, customThemes);
		setDraft(nextDraft);
		setRawCss(serializeThemeCss(nextDraft.values));
		setIsEditorOpen(true);
	};

	const handleVariableChange = (
		mode: ThemeMode,
		key: string,
		value: string,
	) => {
		const nextValues = {
			...draft.values,
			[mode]: {
				...draft.values[mode],
				[key]: value,
			},
		};

		setDraft({ ...draft, values: nextValues });
		setRawCss(serializeThemeCss(nextValues));
	};

	const handleRawCssChange = (nextRawCss: string) => {
		const nextValues = normalizeThemeValues(
			parseThemeCss(nextRawCss),
			draft.values,
		);

		setRawCss(nextRawCss);
		setDraft({ ...draft, values: nextValues });
	};

	const handleSaveDraft = () => {
		const name = draft.name.trim();

		if (!name) {
			return;
		}

		const id = draft.id || `custom-${Date.now()}`;
		const css = serializeThemeCss(draft.values);

		addCustomTheme({ id, name, css });
		setColor(id);
		setIsEditorOpen(false);
	};

	const handleImportFile = async () => {
		try {
			const selectedPath = await open({
				title: "Import Custom Theme",
				multiple: false,
				filters: [{ name: "CSS Files", extensions: ["css"] }],
			});

			if (!selectedPath || typeof selectedPath !== "string") {
				return;
			}

			const fileContents = await readTextFile(selectedPath);
			const fileName =
				selectedPath.split(/[\\/]/).pop()?.replace(".css", "") ||
				"Imported Theme";
			const fallbackValues = buildThemeDraft(
				color,
				allThemes,
				customThemes,
			).values;
			const values = normalizeThemeValues(
				parseThemeCss(fileContents),
				fallbackValues,
			);
			const id = `custom-${Date.now()}`;

			addCustomTheme({
				id,
				name: fileName,
				css: serializeThemeCss(values),
			});
			setColor(id);
		} catch (error) {
			console.error("Failed to import theme:", error);
		}
	};

	return (
		<div className="my-2 flex min-h-9 flex-col justify-between space-y-2 p-2">
			<Label className="text-xs font-mono uppercase tracking-widest opacity-50">
				Theme Management
			</Label>

			<Select
				value={color}
				onValueChange={(nextColor) => {
					if (!nextColor) {
						return;
					}

					setColor(nextColor);
				}}
				items={allThemes}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Select a theme" />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						<SelectLabel>Default</SelectLabel>
						{allThemes
							.filter((theme) => !theme.isCustom)
							.map((theme) => (
								<SelectItem key={theme.value} value={theme.value}>
									{theme.label}
								</SelectItem>
							))}
					</SelectGroup>
					<SelectGroup>
						<SelectLabel>Custom</SelectLabel>
						{allThemes
							.filter((theme) => theme.isCustom)
							.map((theme) => (
								<SelectItem key={theme.value} value={theme.value}>
									{theme.label}
								</SelectItem>
							))}
					</SelectGroup>
				</SelectContent>
			</Select>

			<div className="flex w-full gap-2">
				<Button
					className="flex-1"
					variant="secondary"
					onClick={handleImportFile}
				>
					<Upload className="mr-2 h-4 w-4" /> Import
				</Button>

				<Button className="flex-1" variant="outline" onClick={openEditor}>
					<Palette className="mr-2 h-4 w-4" /> Editor
				</Button>
			</div>

			<ThemeEditorDialog
				open={isEditorOpen}
				onOpenChange={setIsEditorOpen}
				themeName={draft.name}
				onThemeNameChange={(name) => setDraft({ ...draft, name })}
				values={draft.values}
				rawCss={rawCss}
				onRawCssChange={handleRawCssChange}
				onVariableChange={handleVariableChange}
				onSave={handleSaveDraft}
				saveDisabled={!draft.name.trim()}
			/>
		</div>
	);
}
