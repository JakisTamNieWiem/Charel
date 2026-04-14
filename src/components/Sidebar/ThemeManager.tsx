import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Palette, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
			values: selectedCustomTheme.values,
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

function parseImportedThemeFile(contents: string, fallbackValues: ThemeValues) {
	try {
		const parsed = JSON.parse(contents) as Partial<CustomTheme>;

		if (
			typeof parsed?.id === "string" &&
			typeof parsed?.name === "string" &&
			typeof parsed?.values === "object" &&
			parsed.values !== null
		) {
			return {
				name: parsed.name,
				values: normalizeThemeValues(
					parsed.values as ThemeValues,
					fallbackValues,
				),
			};
		}
	} catch {
		// Fall back to CSS parsing below.
	}

	return {
		name: null,
		values: normalizeThemeValues(parseThemeCss(contents), fallbackValues),
	};
}

export default function ThemeManager() {
	const {
		color,
		setColor,
		customThemes,
		customThemesLoaded,
		addCustomTheme,
		openCustomThemesFolder,
		allThemes,
	} = useTheme();
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [draft, setDraft] = useState<ThemeDraft>(() =>
		buildThemeDraft(color, allThemes, customThemes),
	);
	const [rawCss, setRawCss] = useState(() => serializeThemeCss(draft.values));
	const activeCustomTheme =
		customThemes.find((theme) => theme.id === color) ?? null;

	useEffect(() => {
		if (!isEditorOpen) {
			clearThemePreview();
			return;
		}

		applyThemePreview(draft.values);

		return () => clearThemePreview();
	}, [draft.values, isEditorOpen]);

	const openEditorForTheme = (themeId = color) => {
		const nextDraft = buildThemeDraft(themeId, allThemes, customThemes);
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

	const handleSaveDraft = async () => {
		try {
			const name = draft.name.trim();

			if (!name) {
				return;
			}

			const id = draft.id || `custom-${Date.now()}`;
			await addCustomTheme({ id, name, values: draft.values });
			setColor(id);
			setIsEditorOpen(false);
			toast.success("Custom theme saved");
		} catch (error) {
			console.error("Failed to save theme:", error);
			toast.error("Failed to save theme");
		}
	};

	const handleImportFile = async () => {
		try {
			const selectedPath = await open({
				title: "Import Custom Theme",
				multiple: false,
				filters: [
					{ name: "Theme Files", extensions: ["json", "css"] },
					{ name: "JSON Files", extensions: ["json"] },
					{ name: "CSS Files", extensions: ["css"] },
				],
			});

			if (!selectedPath || typeof selectedPath !== "string") {
				return;
			}

			const fileContents = await readTextFile(selectedPath);
			const fallbackName =
				selectedPath
					.split(/[\\/]/)
					.pop()
					?.replace(/\.(json|css)$/i, "") || "Imported Theme";
			const fallbackValues = buildThemeDraft(
				color,
				allThemes,
				customThemes,
			).values;
			const importedTheme = parseImportedThemeFile(
				fileContents,
				fallbackValues,
			);
			const id = `custom-${Date.now()}`;

			await addCustomTheme({
				id,
				name: importedTheme.name ?? fallbackName,
				values: importedTheme.values,
			});
			setColor(id);
			toast.success(`Imported "${importedTheme.name ?? fallbackName}"`);
		} catch (error) {
			console.error("Failed to import theme:", error);
			toast.error("Failed to import theme");
		}
	};
	return (
		<div className="my-2 flex min-h-9 flex-col gap-3 p-2">
			<Label className="text-xs font-mono uppercase tracking-widest opacity-50">
				Theming
			</Label>

			<div className="flex flex-col gap-2 sm:flex-row">
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
					<SelectTrigger className="w-full sm:flex-1">
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
			</div>
			<Button
				className="sm:w-auto"
				variant="secondary"
				onClick={handleImportFile}
			>
				<Upload className="mr-2 h-4 w-4" /> Import CSS
			</Button>

			<Button
				className="sm:w-auto"
				variant="outline"
				disabled={!customThemesLoaded}
				onClick={() => openEditorForTheme()}
			>
				<Palette className="mr-2 h-4 w-4" />
				{activeCustomTheme ? "Edit Theme" : "Customize"}
			</Button>

			<ThemeEditorDialog
				open={isEditorOpen}
				onOpenChange={setIsEditorOpen}
				themeName={draft.name}
				onThemeNameChange={(name) => setDraft({ ...draft, name })}
				values={draft.values}
				rawCss={rawCss}
				onRawCssChange={handleRawCssChange}
				onVariableChange={handleVariableChange}
				onSave={() => void handleSaveDraft()}
				onOpenThemesFolder={() => {
					void openCustomThemesFolder().catch((error) => {
						console.error("Failed to open themes folder:", error);
						toast.error("Failed to open themes folder");
					});
				}}
				saveDisabled={!draft.name.trim()}
			/>
		</div>
	);
}
