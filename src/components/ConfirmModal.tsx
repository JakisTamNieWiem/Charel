import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
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
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<DialogDescription>{message}</DialogDescription>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						Cancel
					</DialogClose>
					<DialogClose
						render={
							<Button onClick={onConfirm} variant="destructive">
								Delete
							</Button>
						}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
