import {
	Navigate,
	createHashHistory,
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import App from "@/App";
import { pagePaths } from "@/lib/app-navigation";
import { CharactersPage, ChatPage, NetworkPage } from "@/routes/pages";

const rootRoute = createRootRoute({
	component: App,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: () => <Navigate to={pagePaths.characters} replace />,
});

const charactersRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: pagePaths.characters,
	component: CharactersPage,
});

const networkRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: pagePaths.network,
	component: NetworkPage,
});

const chatRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: pagePaths.chat,
	component: ChatPage,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	charactersRoute,
	networkRoute,
	chatRoute,
]);

export const router = createRouter({
	routeTree,
	history: createHashHistory(),
	defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
