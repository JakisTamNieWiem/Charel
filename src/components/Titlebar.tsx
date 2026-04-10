import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { Button } from "./ui/button";

export default function Titlebar() {
	const appWindow = getCurrentWindow();
	return (
		<div
			data-tauri-drag-region
			className="h-8 px-2 fixed top-0 left-0 right-0 flex justify-end select-none z-10000 bg-transparent"
		>
			<div className="flex justify-center items-center gap-1">
				<Button
					onClick={() => appWindow.minimize()}
					variant="ghost"
					title="minimize"
					className="size-6 p-1"
				>
					<Minus />
				</Button>
				<Button
					onClick={() => appWindow.toggleMaximize()}
					variant="ghost"
					title="maximize"
					className="size-6 p-1"
				>
					<Square />
				</Button>
				<Button
					onClick={() => appWindow.close()}
					variant="destructive"
					title="close"
					className="size-6 p-1"
				>
					<X />
				</Button>
			</div>
		</div>
	);
}
