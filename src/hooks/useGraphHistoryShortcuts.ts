import { useEffect } from "react";
import { useGraphStore } from "@/store/useGraphStore";

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
	);
}

export function useGraphHistoryShortcuts(enabled: boolean) {
	useEffect(() => {
		if (!enabled) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.isComposing ||
				(!event.ctrlKey && !event.metaKey) ||
				event.key.toLowerCase() !== "z" ||
				isEditableTarget(event.target)
			) {
				return;
			}

			event.preventDefault();
			const history = useGraphStore.temporal.getState();
			if (event.shiftKey) history.redo();
			else history.undo();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [enabled]);
}
