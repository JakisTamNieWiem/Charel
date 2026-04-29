import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import NetworkPage from "@/components/NetworkPage";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/store/useGraphStore";
import { SidebarInset } from "./ui/sidebar";

export default function AppViewport({ pathname }: { pathname: string }) {
	const isNetworkPage = pathname === "/network" || pathname === "/groups";
	const setNetworkMode = useGraphStore((state) => state.setNetworkMode);

	useEffect(() => {
		if (pathname === "/network") {
			setNetworkMode("group");
		} else if (pathname === "/groups") {
			setNetworkMode("groups");
		}
	}, [pathname, setNetworkMode]);

	return (
		<SidebarInset
			className={cn(
				"relative ml-8 mr-8 mb-8 flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-background! transition-all duration-300 ease-in-out after:pointer-events-none after:absolute after:inset-0 after:z-[100] after:rounded-2xl after:shadow-[inset_0_0_30px_rgba(0,0,0,0.1)]",
				pathname !== "/chat" && "bg-dot-grid",
			)}
		>
			<main className="flex-1 relative h-full w-full overflow-hidden flex flex-col">
				<div
					aria-hidden={!isNetworkPage}
					className={cn(
						"absolute inset-0",
						!isNetworkPage && "pointer-events-none opacity-0",
					)}
				>
					<NetworkPage />
				</div>
				<div
					className={cn(
						"absolute inset-0",
						isNetworkPage && "pointer-events-none opacity-0",
					)}
				>
					<Outlet />
				</div>
			</main>
		</SidebarInset>
	);
}
