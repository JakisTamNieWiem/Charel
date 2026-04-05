import { ImagePlus, Send } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readFileAsDataURL, resizeImage } from "@/lib/chat-utils";

interface ChatInputProps {
	draft: string;
	onDraftChange: (value: string) => void;
	onSend: () => void;
	onSendImage: (dataUrl: string) => void;
	disabled: boolean;
	placeholder: string;
}

export default function ChatInput({
	draft,
	onDraftChange,
	onSend,
	onSendImage,
	disabled,
	placeholder,
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSend();
			textareaRef.current?.focus();
		}
	};

	const handleImageUpload = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			const dataUrl =
				file.type === "image/gif"
					? await readFileAsDataURL(file)
					: await resizeImage(file);
			onSendImage(dataUrl);
		};
		input.click();
	};

	return (
		<div className="flex items-end gap-2">
			<Button
				variant="ghost"
				size="icon-sm"
				className="shrink-0 mb-0.5"
				onClick={handleImageUpload}
				disabled={disabled}
				title="Send image"
			>
				<ImagePlus className="w-4 h-4" />
			</Button>
			<Textarea
				ref={textareaRef}
				value={draft}
				onChange={(e) => onDraftChange(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				className="min-h-[36px] max-h-[120px] resize-none text-sm bg-white/5 border-white/10"
				rows={1}
			/>
			<Button
				onClick={onSend}
				disabled={!draft.trim() || disabled}
				size="icon-sm"
				className="shrink-0 mb-0.5"
			>
				<Send className="w-4 h-4" />
			</Button>
		</div>
	);
}
