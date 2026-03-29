import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { TooltipProvider } from "./components/ui/tooltip";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<ThemeProvider>
			<TooltipProvider delayDuration={0} skipDelayDuration={0}>
				<App />
			</TooltipProvider>
		</ThemeProvider>
	</React.StrictMode>,
);
