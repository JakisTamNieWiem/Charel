import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import App from "./App";
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
					<App />
					<Toaster />
				</TooltipProvider>
			</ThemeProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
