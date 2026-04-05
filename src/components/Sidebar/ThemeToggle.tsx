import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	const themeConfig = {
		light: {
			icon: Sun,
			label: "Light",
			className: "text-amber-400",
		},
		dark: {
			icon: Moon,
			label: "Dark",
			className: "text-indigo-400",
		},
		system: {
			icon: Monitor,
			label: "System",
			className: "text-slate-400",
		},
	};

	const { icon: Icon, label, className } = themeConfig[theme];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={
				<Button
					variant="ghost"
					className={cn(
						"flex items-center justify-start gap-2 text-[10px] uppercase font-mono tracking-widest transition-all",
						className
					)}
				>
					<Icon className="w-3 h-3" />
					<span>{label}</span>
				</Button>
			} />
			<DropdownMenuContent align="start">
				<DropdownMenuItem onClick={() => setTheme("light")}>
					<Sun className="mr-2 h-4 w-4" />
					<span>Light</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>
					<Moon className="mr-2 h-4 w-4" />
					<span>Dark</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("system")}>
					<Monitor className="mr-2 h-4 w-4" />
					<span>System</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
