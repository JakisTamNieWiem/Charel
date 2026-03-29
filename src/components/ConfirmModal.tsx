import { useState } from "react";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";

interface ConfirmModalProps {
	title: string;
	message: string;
	onConfirm: () => void;
}

export default function ConfirmModal({
	title,
	message,
	onConfirm,
}: ConfirmModalProps) {
	const [open, setOpen] = useState(false);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant={"destructive"}
					className="px-2 py-1 rounded text-[8px]"
				>
					Delete
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="underline underline-offset-8">
						{title}
					</DialogTitle>
				</DialogHeader>

				<p className="text-sm opacity-70">{message}</p>
				<div className="flex gap-3 pt-4">
					<button
						onClick={() => setOpen(false)}
						className="flex-1 p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors uppercase text-xs font-bold tracking-widest"
					>
						Cancel
					</button>
					<button
						onClick={onConfirm}
						className="flex-1 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors uppercase text-xs font-bold tracking-widest"
					>
						Delete
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
