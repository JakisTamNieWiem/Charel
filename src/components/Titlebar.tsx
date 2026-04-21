import { Minus, Square, X } from "lucide-react";
import { getDesktopApi } from "@/lib/desktop";
import { Button } from "./ui/button";

export default function Titlebar() {
	const desktop = getDesktopApi();

	if (!desktop) {
		return null;
	}

	return (
		<div
			onDoubleClick={() => void desktop.window.toggleMaximize()}
			className="electron-drag h-8 px-2 fixed top-0 left-0 right-0 flex justify-end select-none z-10000 bg-transparent"
		>
			<div className="electron-no-drag flex justify-center items-center gap-1">
				<Button
					onClick={() => void desktop.window.minimize()}
					variant="ghost"
					title="minimize"
					className="size-6 p-1"
				>
					<Minus />
				</Button>
				<Button
					onClick={() => void desktop.window.toggleMaximize()}
					variant="ghost"
					title="maximize"
					className="size-6 p-1"
				>
					<Square />
				</Button>
				<Button
					onClick={() => void desktop.window.close()}
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
