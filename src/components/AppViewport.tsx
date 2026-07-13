import { Outlet } from "@tanstack/react-router";
import { SidebarInset } from "./ui/sidebar";

export default function AppViewport() {
	return (
		<SidebarInset className="relative ml-8 mr-8 mb-8 flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-background! bg-dot-grid transition-all duration-300 ease-in-out after:pointer-events-none after:absolute after:inset-0 after:z-100 after:rounded-2xl after:shadow-[inset_0_0_30px_rgba(0,0,0,0.1)]">
			<main className="flex-1 relative h-full w-full overflow-hidden flex flex-col">
				<div className="absolute inset-0">
					<Outlet />
				</div>
			</main>
		</SidebarInset>
	);
}
