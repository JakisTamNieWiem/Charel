export type AppPage = "characters" | "network" | "chat";

export type SidebarTab =
	| "characters"
	| "network"
	| "groups"
	| "types"
	| "settings"
	| "chat";

export const pagePaths: Record<AppPage, "/characters" | "/network" | "/chat"> =
	{
		characters: "/characters",
		network: "/network",
		chat: "/chat",
	};

export const sidebarTabToPage: Record<SidebarTab, AppPage> = {
	characters: "characters",
	network: "network",
	groups: "network",
	types: "characters",
	settings: "characters",
	chat: "chat",
};

export const defaultSidebarTabByPage: Record<AppPage, SidebarTab> = {
	characters: "characters",
	network: "network",
	chat: "chat",
};

export function pathnameToPage(pathname: string): AppPage {
	if (pathname === pagePaths.network) return "network";
	if (pathname === pagePaths.chat) return "chat";
	return "characters";
}
