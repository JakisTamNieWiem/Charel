import { Plus, Trash2, X } from "lucide-react";
import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import type { Group } from "@/types/types";
import {
	SidebarEmptyState,
	SidebarPanel,
	SidebarSection,
	SidebarTabHeader,
	SidebarTabRoot,
	sidebarInputClass,
} from "./SidebarTabLayout";

function hueToRgb(p: number, q: number, t: number) {
	let adjustedT = t;

	if (adjustedT < 0) adjustedT += 1;
	if (adjustedT > 1) adjustedT -= 1;
	if (adjustedT < 1 / 6) return p + (q - p) * 6 * adjustedT;
	if (adjustedT < 1 / 2) return q;
	if (adjustedT < 2 / 3) return p + (q - p) * (2 / 3 - adjustedT) * 6;
	return p;
}

function byteToHex(value: number) {
	return Math.round(Math.min(Math.max(value, 0), 255))
		.toString(16)
		.padStart(2, "0");
}

function hslToHex(hue: number, saturation: number, lightness: number) {
	const normalizedHue = (((hue % 360) + 360) % 360) / 360;
	const clampedSaturation = Math.min(Math.max(saturation, 0), 1);
	const clampedLightness = Math.min(Math.max(lightness, 0), 1);

	if (clampedSaturation === 0) {
		const grey = byteToHex(clampedLightness * 255);
		return `#${grey}${grey}${grey}`;
	}

	const q =
		clampedLightness < 0.5
			? clampedLightness * (1 + clampedSaturation)
			: clampedLightness +
				clampedSaturation -
				clampedLightness * clampedSaturation;
	const p = 2 * clampedLightness - q;

	return `#${byteToHex(hueToRgb(p, q, normalizedHue + 1 / 3) * 255)}${byteToHex(
		hueToRgb(p, q, normalizedHue) * 255,
	)}${byteToHex(hueToRgb(p, q, normalizedHue - 1 / 3) * 255)}`;
}

function getColorInputValue(color: string) {
	const trimmedColor = color.trim();

	if (/^#[0-9a-f]{6}$/i.test(trimmedColor)) {
		return trimmedColor;
	}

	const shortHexMatch = trimmedColor.match(
		/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i,
	);

	if (shortHexMatch) {
		return `#${shortHexMatch[1]}${shortHexMatch[1]}${shortHexMatch[2]}${shortHexMatch[2]}${shortHexMatch[3]}${shortHexMatch[3]}`;
	}

	const hslMatch = trimmedColor.match(/^hsla?\((.+)\)$/i);

	if (hslMatch) {
		const parts = hslMatch[1]
			.replace(/\//g, " ")
			.split(/[,\s]+/)
			.filter(Boolean);

		if (parts.length >= 3) {
			const hue = Number.parseFloat(parts[0]);
			const saturation = Number.parseFloat(parts[1]) / 100;
			const lightness = Number.parseFloat(parts[2]) / 100;

			if (![hue, saturation, lightness].some((part) => Number.isNaN(part))) {
				return hslToHex(hue, saturation, lightness);
			}
		}
	}

	return "#ffffff";
}

function getRandomGroupColor() {
	return hslToHex(Math.round(Math.random() * 360), 0.7, 0.5);
}

export default function GroupsTab() {
	const allCharacters = useGraphStore((state) => state.characters);
	const groups = useGraphStore((state) => state.groups);
	const addGroup = useGraphStore((state) => state.addGroup);
	const updateGroup = useGraphStore((state) => state.updateGroup);
	const deleteGroup = useGraphStore((state) => state.deleteGroup);
	const assignCharacterToGroup = useGraphStore(
		(state) => state.assignCharacterToGroup,
	);
	const debounceTimer = useRef<number | null>(null);
	const ungroupedCharacters = allCharacters.filter((c) => !c.groupId);

	return (
		<SidebarTabRoot>
			<SidebarTabHeader
				title="Groups"
				count={groups.length}
				action={
					<Button
						variant="ghost"
						size="icon-sm"
						title="New group"
						onClick={() =>
							addGroup({
								name: `Group ${groups.length + 1}`,
								color: getRandomGroupColor(),
							})
						}
						className="hover:bg-(--sidebar-foreground)/8"
					>
						<Plus className="w-4 h-4" />
					</Button>
				}
			/>

			<SidebarSection>
				{groups.length === 0 && (
					<SidebarEmptyState title="No groups yet">
						Create a group to cluster characters on the graph.
					</SidebarEmptyState>
				)}

				<div className="space-y-3">
					{groups.map((group) => {
						const members = allCharacters.filter((c) => c.groupId === group.id);
						const unassigned = allCharacters
							.filter((c) => !c.groupId || c.groupId === group.id)
							.sort((a, b) => a.name.localeCompare(b.name));
						const availableToAdd = unassigned.filter(
							(c) => c.groupId !== group.id,
						);

						return (
							<SidebarPanel key={group.id} className="group overflow-hidden">
								<div className="flex items-center gap-2 border-b border-(--sidebar-foreground)/8 px-3 py-2.5">
									<label
										className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-full"
										style={{ backgroundColor: group.color }}
										title="Group color"
									>
										<Input
											type="color"
											value={getColorInputValue(group.color)}
											onChange={(e) => {
												const editedGroup = {
													id: group.id,
													name: group.name,
													color: e.target.value,
												};
												if (debounceTimer.current)
													clearTimeout(debounceTimer.current);
												debounceTimer.current = window.setTimeout(() => {
													updateGroup(editedGroup as Group);
												}, 500);
											}}
											className="absolute inset-0 size-full cursor-pointer opacity-0"
											aria-label="Group color"
										/>
									</label>
									<Input
										value={group.name}
										onChange={(e) =>
											updateGroup({
												id: group.id,
												name: e.target.value,
												color: group.color,
											})
										}
										className={cn(
											sidebarInputClass,
											"h-8 flex-1 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:bg-(--sidebar-foreground)/5",
										)}
									/>
									<Button
										variant="ghost"
										size="icon-xs"
										title="Delete group"
										onClick={() => deleteGroup(group.id)}
										className="opacity-45 hover:bg-(--sidebar-foreground)/8 hover:text-red-400 group-hover:opacity-100"
									>
										<Trash2 className="w-3 h-3" />
									</Button>
								</div>

								<div className="space-y-1 p-2">
									<div className="flex items-center justify-between px-1 pb-1">
										<span className="text-[0.625rem] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
											Members
										</span>
										<span className="text-[0.625rem] font-mono text-muted-foreground/55 tabular-nums">
											{members.length}
										</span>
									</div>
									{members.map((char) => (
										<div
											key={char.id}
											className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-(--sidebar-foreground)/5"
										>
											<Avatar className="size-6">
												<AvatarImage src={char.avatar ?? undefined} />
												<AvatarFallback className="text-[8px]">
													{char.name.slice(0, 2)}
												</AvatarFallback>
											</Avatar>
											<span className="flex-1 truncate text-xs font-medium">
												{char.name}
											</span>
											<Button
												variant="ghost"
												size="icon-xs"
												title="Remove from group"
												onClick={() => assignCharacterToGroup(char.id, null)}
												className="opacity-35 hover:bg-(--sidebar-foreground)/8 hover:text-red-400 hover:opacity-100"
											>
												<X className="w-3 h-3" />
											</Button>
										</div>
									))}

									<Select
										value=""
										disabled={availableToAdd.length === 0}
										onValueChange={(val) => {
											if (val) {
												assignCharacterToGroup(val, group.id);
											}
										}}
									>
										<SelectTrigger
											disabled={availableToAdd.length === 0}
											className="mt-2 h-8 w-full rounded-md border border-dashed border-(--sidebar-foreground)/12 bg-(--sidebar-foreground)/4 px-2 text-[0.6875rem] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-(--sidebar-foreground)/20 hover:bg-(--sidebar-foreground)/6 disabled:opacity-35"
										>
											<SelectValue
												placeholder={
													availableToAdd.length === 0
														? "All characters assigned"
														: "+ Add character..."
												}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{availableToAdd.map((c) => (
													<SelectItem key={c.id} value={c.id}>
														{c.name}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</div>
							</SidebarPanel>
						);
					})}
				</div>
			</SidebarSection>

			{ungroupedCharacters.length > 0 && (
				<SidebarSection title="Ungrouped" count={ungroupedCharacters.length}>
					<SidebarPanel className="overflow-hidden border-dashed">
						<div className="space-y-1 p-2">
							{ungroupedCharacters.map((char) => (
								<div
									key={char.id}
									className="flex items-center gap-2 rounded-md px-2 py-1.5"
								>
									<Avatar className="size-6 opacity-65">
										<AvatarImage src={char.avatar ?? undefined} />
										<AvatarFallback className="text-[8px]">
											{char.name.slice(0, 2)}
										</AvatarFallback>
									</Avatar>
									<span className="flex-1 truncate text-xs text-muted-foreground">
										{char.name}
									</span>
								</div>
							))}
						</div>
					</SidebarPanel>
				</SidebarSection>
			)}
		</SidebarTabRoot>
	);
}
