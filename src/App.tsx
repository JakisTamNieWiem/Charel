import { useEffect } from "react";
import AppViewport from "@/components/AppViewport";
import AppSidebar from "@/components/Sidebar/Sidebar";
import { useGraphStore } from "@/store/useGraphStore";
import "./styles.css";
import { saveToDisk } from "@/lib/storage";
import { SidebarProvider } from "./components/ui/sidebar";
import { useAuth } from "./context/AuthProvider";
import { useRealtimeSync } from "./hooks/useRealtimeSync";

function App() {
	const { session, loading } = useAuth();
	useRealtimeSync();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (session) return;
			if (e.ctrlKey && e.key === "z") {
				useGraphStore.temporal.getState().undo();
			}
			if (e.ctrlKey && e.shiftKey && e.key === "z") {
				useGraphStore.temporal.getState().redo();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [session]);

	useEffect(() => {
		const unsubscribe = useGraphStore.subscribe((state, prevState) => {
			// Don't save if we haven't finished the initial load yet
			if (loading || session) return;

			// Optional: Only save if the actual graph data changed (ignore UI state like selectedCharId)
			if (
				state.characters !== prevState.characters ||
				state.relationships !== prevState.relationships ||
				state.relationshipTypes !== prevState.relationshipTypes ||
				state.groups !== prevState.groups
			) {
				saveToDisk({
					version: "2",
					characters: state.characters,
					relationships: state.relationships,
					relationshipTypes: state.relationshipTypes,
					groups: state.groups,
				});
			}
		});

		return () => unsubscribe();
	}, [loading, session]);

	return (
		<div className="flex h-screen w-screen overflow-hidden bg-sidebar font-sans text-foreground">
			<SidebarProvider
				defaultOpen={true}
				style={{ "--sidebar-width": "22rem" } as React.CSSProperties}
				className="max-h-screen! max-w-screen! pt-8"
			>
				<AppSidebar />
				<AppViewport />
			</SidebarProvider>
		</div>
	);
}

export default App;
