import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { router } from "@/router";
import { ThemeProvider } from "./components/ThemeProvider";
import Titlebar from "./components/Titlebar";
import { TooltipProvider } from "./components/ui/tooltip";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<ThemeProvider defaultTheme="dark" defaultColor="zen">
				<TooltipProvider>
					<Titlebar />
					<RouterProvider router={router} />
					<Toaster richColors />
				</TooltipProvider>
			</ThemeProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
