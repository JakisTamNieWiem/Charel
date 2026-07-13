import { useEffect } from "react";
import { saveGraphBackup } from "@/lib/storage";
import { createGraphSnapshot, useGraphStore } from "@/store/useGraphStore";

export function useGraphBackup() {
	useEffect(() => {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		let pendingWrite = Promise.resolve();

		const unsubscribe = useGraphStore.subscribe((state, previousState) => {
			if (
				state.characters === previousState.characters &&
				state.relationshipTypes === previousState.relationshipTypes &&
				state.relationships === previousState.relationships &&
				state.groups === previousState.groups
			) {
				return;
			}

			clearTimeout(timeout);
			timeout = setTimeout(() => {
				const snapshot = createGraphSnapshot(useGraphStore.getState());
				pendingWrite = pendingWrite.then(() => saveGraphBackup(snapshot));
			}, 400);
		});

		return () => {
			clearTimeout(timeout);
			unsubscribe();
		};
	}, []);
}
