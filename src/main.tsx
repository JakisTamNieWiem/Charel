import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<ThemeProvider>
			<TooltipProvider>
				<SidebarProvider>
					<App />
					<Toaster />
				</SidebarProvider>
			</TooltipProvider>
		</ThemeProvider>
	</React.StrictMode>,
);
