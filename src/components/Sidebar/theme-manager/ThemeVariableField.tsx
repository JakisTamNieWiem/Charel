import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
	formatOklchValue,
	isOklchValue,
	type OklchColor,
	parseOklchValue,
} from "@/lib/theme-editor";

type ThemeVariableFieldProps = {
	varKey: string;
	value: string;
	onChange: (value: string) => void;
};

function getSliderValue(value: number | readonly number[], fallback: number) {
	return Array.isArray(value) ? (value[0] ?? fallback) : value;
}

function OklchField({ varKey, value, onChange }: ThemeVariableFieldProps) {
	const [open, setOpen] = useState(false);
	const [localValue, setLocalValue] = useState<OklchColor>(() =>
		parseOklchValue(value),
	);

	useEffect(() => {
		if (!open) {
			setLocalValue(parseOklchValue(value));
		}
	}, [open, value]);

	const previewValue = formatOklchValue(localValue);

	return (
		<div className="space-y-1.5">
			<Label className="block truncate text-xs" title={varKey}>
				{varKey}
			</Label>
			<Popover
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);

					if (!nextOpen) {
						onChange(formatOklchValue(localValue));
					}
				}}
			>
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							className="h-8 w-full justify-start gap-2 px-2 font-mono"
						>
							<div
								className="h-4 w-4 rounded-full border shadow-sm"
								style={{ backgroundColor: previewValue }}
							/>
							<span className="truncate text-[10px]">{previewValue}</span>
						</Button>
					}
				/>
				<PopoverContent className="w-72 space-y-4" sideOffset={8}>
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs">Lightness</Label>
							<span className="text-xs text-muted-foreground">
								{localValue.l.toFixed(4)}
							</span>
						</div>
						<Slider
							value={[localValue.l]}
							min={0}
							max={1}
							step={0.005}
							onValueChange={(nextValue) =>
								setLocalValue((current) => ({
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
								{localValue.c.toFixed(4)}
							</span>
						</div>
						<Slider
							value={[localValue.c]}
							min={0}
							max={0.4}
							step={0.005}
							onValueChange={(nextValue) =>
								setLocalValue((current) => ({
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
								{localValue.h.toFixed(4)}
							</span>
						</div>
						<Slider
							value={[localValue.h]}
							min={0}
							max={360}
							step={1}
							onValueChange={(nextValue) =>
								setLocalValue((current) => ({
									...current,
									h: getSliderValue(nextValue, current.h),
								}))
							}
						/>
					</div>
					<div
						className="mt-2 h-10 w-full rounded-md border shadow-inner"
						style={{ backgroundColor: previewValue }}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}

function TextField({ varKey, value, onChange }: ThemeVariableFieldProps) {
	const [localValue, setLocalValue] = useState(value);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	return (
		<div className="space-y-1.5">
			<Label className="block truncate text-xs" title={varKey}>
				{varKey}
			</Label>
			<Input
				className="h-8 font-mono text-[11px]"
				value={localValue}
				onChange={(event) => setLocalValue(event.target.value)}
				onBlur={() => onChange(localValue)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.currentTarget.blur();
					}
				}}
			/>
		</div>
	);
}

export function ThemeVariableField(props: ThemeVariableFieldProps) {
	if (isOklchValue(props.value)) {
		return <OklchField {...props} />;
	}

	return <TextField {...props} />;
}
