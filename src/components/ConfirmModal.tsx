import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmModalProps {
	title: string;
	message: string;
	onConfirm: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function ConfirmModal({
	title,
	message,
	onConfirm,
	open,
	onOpenChange,
}: ConfirmModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="underline underline-offset-8">
						{title}
					</DialogTitle>
				</DialogHeader>
				<p className="text-sm opacity-70">{message}</p>
				<DialogFooter>
					<DialogClose
						render={
							<Button
								variant={"secondary"}
								className="flex-1 p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors uppercase text-xs font-bold tracking-widest"
							>
								Cancel
							</Button>
						}
					></DialogClose>
					<DialogClose
						render={
							<Button
								onClick={onConfirm}
								className="flex-1 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors uppercase text-xs font-bold tracking-widest"
							>
								Delete
							</Button>
						}
					></DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
