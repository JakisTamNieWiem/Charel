import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
	type BoxShadowLayer,
	formatHexColor,
	formatLengthValue,
	formatOklchValue,
	formatRgbaValue,
	formatShadowValue,
	getThemeVariableDescription,
	isColorValue,
	isOklchValue,
	type OklchColor,
	parseColorValue,
	parseLengthValue,
	parseOklchValue,
	parseShadowValue,
	type RgbaColor,
} from "@/lib/theme-editor";

type ThemeVariableFieldProps = {
	varKey: string;
	value: string;
	onChange: (value: string) => void;
};

function getSliderValue(value: number | readonly number[], fallback: number) {
	return Array.isArray(value) ? (value[0] ?? fallback) : value;
}

function FieldShell({
	children,
	varKey,
	description = getThemeVariableDescription(varKey),
}: {
	children: ReactNode;
	varKey: string;
	description?: string;
}) {
	const displayName = varKey
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

	return (
		<div className="rounded-lg border border-border/70 bg-background/80 p-2.5 shadow-xs">
			<div className="mb-2.5 space-y-1">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<Label
							className="block truncate text-[13px] font-medium"
							title={varKey}
						>
							{displayName}
						</Label>
						<p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
							--{varKey}
						</p>
					</div>
				</div>
				{description ? (
					<p className="text-[11px] leading-snug text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			<div className="space-y-1.5">{children}</div>
		</div>
	);
}

function PopoverColorControl({
	value,
	onChange,
	compact = false,
}: {
	value: string;
	onChange: (value: string) => void;
	compact?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [oklchValue, setOklchValue] = useState<OklchColor>(() =>
		parseOklchValue(value),
	);
	const [rgbaValue, setRgbaValue] = useState<RgbaColor>(
		() => parseColorValue(value) ?? { r: 0, g: 0, b: 0, a: 1 },
	);
	const currentValue = isOklchValue(value)
		? formatOklchValue(oklchValue)
		: formatRgbaValue(rgbaValue);

	useEffect(() => {
		if (!open) {
			setOklchValue(parseOklchValue(value));
			setRgbaValue(parseColorValue(value) ?? { r: 0, g: 0, b: 0, a: 1 });
		}
	}, [open, value]);

	return (
		<Popover
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);

				if (!nextOpen) {
					onChange(currentValue);
				}
			}}
		>
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						className={
							compact
								? "h-8 w-full justify-start gap-2 rounded-lg border-border/70 bg-background px-2.5 font-mono text-[11px]"
								: "h-8 w-full justify-start gap-2 rounded-lg border-border/70 bg-background px-2.5 font-mono"
						}
					>
						<div
							className="h-3.5 w-3.5 shrink-0 rounded-full border shadow-sm"
							style={{ backgroundColor: currentValue }}
						/>
						<span className="truncate text-[10px]">{currentValue}</span>
					</Button>
				}
			/>
			<PopoverContent className="w-72 space-y-4" sideOffset={8}>
				{isOklchValue(value) ? (
					<>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Lightness</Label>
								<span className="text-xs text-muted-foreground">
									{oklchValue.l.toFixed(4)}
								</span>
							</div>
							<Slider
								value={[oklchValue.l]}
								min={0}
								max={1}
								step={0.005}
								onValueChange={(nextValue) =>
									setOklchValue((current) => ({
										...current,
										l: getSliderValue(nextValue, current.l),
									}))
								}
							/>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Chroma</Label>
								<span className="text-xs text-muted-foreground">
									{oklchValue.c.toFixed(4)}
								</span>
							</div>
							<Slider
								value={[oklchValue.c]}
								min={0}
								max={0.4}
								step={0.005}
								onValueChange={(nextValue) =>
									setOklchValue((current) => ({
										...current,
										c: getSliderValue(nextValue, current.c),
									}))
								}
							/>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Hue</Label>
								<span className="text-xs text-muted-foreground">
									{oklchValue.h.toFixed(1)}
								</span>
							</div>
							<Slider
								value={[oklchValue.h]}
								min={0}
								max={360}
								step={1}
								onValueChange={(nextValue) =>
									setOklchValue((current) => ({
										...current,
										h: getSliderValue(nextValue, current.h),
									}))
								}
							/>
						</div>
					</>
				) : (
					<>
						<div className="space-y-2">
							<Label className="text-xs">Pick a color</Label>
							<input
								type="color"
								className="h-10 w-full cursor-pointer rounded-md border border-input bg-transparent p-1"
								value={formatHexColor(rgbaValue)}
								onChange={(event) => {
									const nextColor = parseColorValue(event.target.value);

									if (nextColor) {
										setRgbaValue((current) => ({
											...current,
											...nextColor,
											a: current.a,
										}));
									}
								}}
							/>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Opacity</Label>
								<span className="text-xs text-muted-foreground">
									{Math.round(rgbaValue.a * 100)}%
								</span>
							</div>
							<Slider
								value={[rgbaValue.a]}
								min={0}
								max={1}
								step={0.01}
								onValueChange={(nextValue) =>
									setRgbaValue((current) => ({
										...current,
										a: getSliderValue(nextValue, current.a),
									}))
								}
							/>
						</div>
					</>
				)}
				<div
					className="h-10 w-full rounded-md border shadow-inner"
					style={{ backgroundColor: currentValue }}
				/>
			</PopoverContent>
		</Popover>
	);
}

function ColorField({ varKey, value, onChange }: ThemeVariableFieldProps) {
	return (
		<FieldShell varKey={varKey}>
			<PopoverColorControl value={value} onChange={onChange} />
		</FieldShell>
	);
}

function TextField({ varKey, value, onChange }: ThemeVariableFieldProps) {
	const [localValue, setLocalValue] = useState(value);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	return (
		<FieldShell varKey={varKey}>
			<Input
				className="h-8 rounded-lg border-border/70 bg-background font-mono text-[11px]"
				value={localValue}
				onChange={(event) => setLocalValue(event.target.value)}
				onBlur={() => onChange(localValue)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.currentTarget.blur();
					}
				}}
			/>
		</FieldShell>
	);
}

function LengthField({ varKey, value, onChange }: ThemeVariableFieldProps) {
	const [localValue, setLocalValue] = useState(() => parseLengthValue(value));

	useEffect(() => {
		setLocalValue(parseLengthValue(value));
	}, [value]);

	if (!localValue) {
		return <TextField varKey={varKey} value={value} onChange={onChange} />;
	}

	const commit = (nextValue = localValue) => {
		onChange(formatLengthValue(nextValue.value, nextValue.unit));
	};

	return (
		<FieldShell varKey={varKey}>
			<div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
				<Input
					className="input-no-spin h-8 rounded-lg border-border/70 bg-background font-mono text-[11px]"
					type="number"
					step="0.01"
					value={localValue.value}
					onChange={(event) =>
						setLocalValue((current) =>
							current
								? {
										...current,
										value: Number.parseFloat(event.target.value || "0"),
									}
								: current,
						)
					}
					onBlur={() => commit()}
				/>
				<Select
					value={localValue.unit}
					onValueChange={(nextUnit) => {
						if (!nextUnit) {
							return;
						}

						const nextValue = { ...localValue, unit: nextUnit };
						setLocalValue(nextValue);
						commit(nextValue);
					}}
				>
					<SelectTrigger className="h-8 w-full rounded-lg border-border/70 bg-background text-xs">
						<SelectValue placeholder="Unit" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="px">px</SelectItem>
						<SelectItem value="rem">rem</SelectItem>
						<SelectItem value="em">em</SelectItem>
						<SelectItem value="%">%</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</FieldShell>
	);
}

function NumberField({ varKey, value, onChange }: ThemeVariableFieldProps) {
	const [localValue, setLocalValue] = useState(() => Number.parseFloat(value));
	const isOpacity = varKey.includes("opacity");
	const safeValue = Number.isFinite(localValue) ? localValue : 0;

	useEffect(() => {
		setLocalValue(Number.parseFloat(value));
	}, [value]);

	return (
		<FieldShell varKey={varKey}>
			<div className="space-y-2">
				{isOpacity ? (
					<Slider
						value={[safeValue]}
						min={0}
						max={1}
						step={0.01}
						onValueChange={(nextValue) => {
							const next = getSliderValue(nextValue, safeValue);
							setLocalValue(next);
							onChange(next.toFixed(2));
						}}
					/>
				) : null}
				<Input
					className="input-no-spin h-8 rounded-lg border-border/70 bg-background font-mono text-[11px]"
					type="number"
					step={isOpacity ? "0.01" : "1"}
					value={safeValue}
					onChange={(event) =>
						setLocalValue(Number.parseFloat(event.target.value))
					}
					onBlur={() =>
						onChange(isOpacity ? safeValue.toFixed(2) : String(safeValue))
					}
				/>
			</div>
		</FieldShell>
	);
}

function ShadowLayerEditor({
	label,
	layer,
	onChange,
}: {
	label: string;
	layer: BoxShadowLayer;
	onChange: (layer: BoxShadowLayer) => void;
}) {
	return (
		<div className="space-y-2.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
			<div className="flex items-center justify-between">
				<Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
					{label}
				</Label>
				<span className="text-[10px] text-muted-foreground">
					{layer.x}px / {layer.y}px
				</span>
			</div>
			<div className="grid grid-cols-2 gap-2">
				{(
					[
						["x", "Offset X"],
						["y", "Offset Y"],
						["blur", "Blur"],
						["spread", "Spread"],
					] as const
				).map(([key, labelText]) => (
					<div key={key} className="space-y-1">
						<Label className="text-[10px] text-muted-foreground">
							{labelText}
						</Label>
						<Input
							className="input-no-spin h-8 rounded-lg border-border/70 bg-background font-mono text-[11px]"
							type="number"
							value={layer[key]}
							onChange={(event) =>
								onChange({
									...layer,
									[key]: Number.parseFloat(event.target.value || "0"),
								})
							}
						/>
					</div>
				))}
			</div>
			<div className="space-y-1">
				<Label className="text-[10px] text-muted-foreground">Color</Label>
				<PopoverColorControl
					value={layer.color}
					onChange={(color) => onChange({ ...layer, color })}
					compact
				/>
			</div>
		</div>
	);
}

function ShadowField({ varKey, value, onChange }: ThemeVariableFieldProps) {
	const [open, setOpen] = useState(false);
	const [layers, setLayers] = useState<BoxShadowLayer[]>(
		() => parseShadowValue(value) ?? [],
	);

	useEffect(() => {
		if (!open) {
			setLayers(parseShadowValue(value) ?? []);
		}
	}, [open, value]);

	if (layers.length === 0) {
		return <TextField varKey={varKey} value={value} onChange={onChange} />;
	}

	const shadowPreview = formatShadowValue(layers);

	return (
		<FieldShell varKey={varKey}>
			<Popover
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);

					if (!nextOpen) {
						onChange(formatShadowValue(layers));
					}
				}}
			>
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							className="h-auto min-h-8 w-full items-start justify-between gap-3 rounded-lg border-border/70 bg-background px-2.5 py-2 text-left"
						>
							<div className="min-w-0 space-y-1">
								<div className="truncate font-mono text-[10px] text-muted-foreground">
									{layers.length} layer{layers.length > 1 ? "s" : ""}
								</div>
								<div className="truncate font-mono text-[10px]">
									{shadowPreview}
								</div>
							</div>
							<div
								className="mt-0.5 h-6 w-10 shrink-0 rounded-md border bg-card shadow-sm"
								style={{ boxShadow: shadowPreview }}
							/>
						</Button>
					}
				/>
				<PopoverContent className="w-[26rem] space-y-3" sideOffset={8}>
					{layers.map((layer, index) => (
						<ShadowLayerEditor
							key={`${varKey}-${layer.x}-${layer.y}-${layer.blur}-${layer.spread}-${layer.color}`}
							label={`Layer ${index + 1}`}
							layer={layer}
							onChange={(nextLayer) =>
								setLayers((current) =>
									current.map((item, itemIndex) =>
										itemIndex === index ? nextLayer : item,
									),
								)
							}
						/>
					))}
				</PopoverContent>
			</Popover>
		</FieldShell>
	);
}

export function ThemeVariableField(props: ThemeVariableFieldProps) {
	if (isColorValue(props.value)) {
		return <ColorField {...props} />;
	}

	if (props.varKey.startsWith("shadow-") && parseShadowValue(props.value)) {
		return <ShadowField {...props} />;
	}

	if (parseLengthValue(props.value)) {
		return <LengthField {...props} />;
	}

	if (/^-?\d*\.?\d+$/.test(props.value.trim())) {
		return <NumberField {...props} />;
	}

	return <TextField {...props} />;
}
