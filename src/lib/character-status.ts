export const CHARACTER_STATUS_VALUES = [
	"online",
	"away",
	"dnd",
	"offline",
] as const;

export type CharacterStatus = (typeof CHARACTER_STATUS_VALUES)[number];

const STATUS_LABELS: Record<CharacterStatus, string> = {
	online: "Online",
	away: "Away",
	dnd: "Do not disturb",
	offline: "Offline",
};

const STATUS_DOT_CLASSES: Record<CharacterStatus, string> = {
	online: "bg-emerald-500 text-emerald-500",
	away: "bg-amber-400 text-amber-400",
	dnd: "bg-rose-500 text-rose-500",
	offline: "bg-muted-foreground/50 text-muted-foreground/50",
};

const STATUS_BADGE_CLASSES: Record<CharacterStatus, string> = {
	online:
		"border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
	away:
		"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	dnd: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
	offline:
		"border-border bg-muted/40 text-muted-foreground",
};

export function isCharacterStatus(value: unknown): value is CharacterStatus {
	return (
		typeof value === "string" &&
		CHARACTER_STATUS_VALUES.includes(value as CharacterStatus)
	);
}

export function normalizeCharacterStatus(value: unknown): CharacterStatus {
	return isCharacterStatus(value) ? value : "offline";
}

export function getCharacterStatusLabel(status: CharacterStatus) {
	return STATUS_LABELS[status];
}

export function getCharacterStatusDotClass(status: CharacterStatus) {
	return STATUS_DOT_CLASSES[status];
}

export function getCharacterStatusBadgeClass(status: CharacterStatus) {
	return STATUS_BADGE_CLASSES[status];
}
