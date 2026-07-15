import AppViewport from "@/components/AppViewport";
import LoadingScreen from "@/components/LoadingScreen";
import AppSidebar from "@/components/Sidebar/Sidebar";
import { useGraphBackup } from "@/hooks/useGraphBackup";
import { useGraphHistoryShortcuts } from "@/hooks/useGraphHistoryShortcuts";
import { useGraphStore } from "@/store/useGraphStore";
import "./styles.css";
import { SidebarProvider } from "./components/ui/sidebar";
import { useAuth } from "./context/AuthProvider";
import { useRealtimeSync } from "./hooks/useRealtimeSync";

function App() {
	const { session, loading } = useAuth();
	const isInitialized = useGraphStore((state) => state.isInitialized);
	useRealtimeSync();
	useGraphBackup();
	useGraphHistoryShortcuts(!session);

	if (loading || !isInitialized) return <LoadingScreen />;

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
