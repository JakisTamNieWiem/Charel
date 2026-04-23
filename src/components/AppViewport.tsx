import { Outlet } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NetworkPage } from "@/routes/pages";
import { SidebarInset } from "./ui/sidebar";

export default function AppViewport({ pathname }: { pathname: string }) {
	const isNetworkPage = pathname === "/network";

	return (
		<SidebarInset
			className={cn(
				"relative flex flex-col overflow-hidden transition-all duration-300 ease-in-out bg-background! shadow-[inset_0_0_10px_2px_rgba(0,0,0,0.2)]! ring-1 ring-inset ring-white/80 dark:ring-black/80",
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
				{!isNetworkPage && (
					<div className="absolute inset-0">
						<Outlet />
					</div>
				)}
			</main>
		</SidebarInset>
	);
}
