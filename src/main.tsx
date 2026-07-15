import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { checkForUpdates } from "@/lib/updater";
import { router } from "@/router";
import Titlebar from "./components/Titlebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./context/AuthProvider";
import { ThemeProvider } from "./context/ThemeProvider";

const queryClient = new QueryClient();

void checkForUpdates();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<AuthProvider>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider defaultTheme="dark" defaultColor="zen">
					<TooltipProvider>
						<Titlebar />
						<RouterProvider router={router} />
						<Toaster richColors />
					</TooltipProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</AuthProvider>
	</React.StrictMode>,
);
