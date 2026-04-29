import {
	Layers,
	Link,
	MapIcon,
	MessageCircle,
	Network,
	Settings,
	Users,
} from "lucide-react";
import type { ComponentType, ElementType } from "react";
import CharacterTab from "@/components/Sidebar/CharacterTab";
import ChatTab from "@/components/Sidebar/ChatTab";
import GroupsTab from "@/components/Sidebar/GroupsTab";
import NetworkTab from "@/components/Sidebar/NetworkTab";
import RelationshipTypesTab from "@/components/Sidebar/RelationshipTypesTab";
import SettingsTab from "@/components/Sidebar/SettingsTab";
import VirtualTabletopTab from "@/components/VTT/VirtualTabletopTab";

type SidebarNavigationItem = {
	value: string;
	to: string;
	icon: ElementType;
	title: string;
	panel: ComponentType;
	networkMode?: "group" | "groups";
};

export const sidebarNavItems = [
	{
		value: "characters",
		to: "/characters",
		icon: Users,
		title: "Characters",
		panel: CharacterTab,
	},
	{
		value: "network",
		to: "/network",
		icon: Network,
		title: "Network Graph",
		panel: NetworkTab,
		networkMode: "group",
	},
	{
		value: "groups",
		to: "/groups",
		icon: Layers,
		title: "Groups",
		panel: GroupsTab,
		networkMode: "groups",
	},
	{
		value: "types",
		to: "/types",
		icon: Link,
		title: "Relationship Types",
		panel: RelationshipTypesTab,
	},
	{
		value: "chat",
		to: "/chat",
		icon: MessageCircle,
		title: "Chat",
		panel: ChatTab,
	},
	{
		value: "vtt",
		to: "/vtt",
		icon: MapIcon,
		title: "VTT",
		panel: VirtualTabletopTab,
	},
	{
		value: "settings",
		to: "/settings",
		icon: Settings,
		title: "Settings",
		panel: SettingsTab,
	},
] as const satisfies readonly SidebarNavigationItem[];

export type SidebarTab = (typeof sidebarNavItems)[number]["value"];

export function getSidebarItemForPath(pathname: string) {
	return (
		sidebarNavItems.find((item) => item.to === pathname) ?? sidebarNavItems[0]
	);
}
