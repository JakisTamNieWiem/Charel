import { ImagePlus, Send, Sticker, Smile } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readFileAsDataURL, resizeImage } from "@/lib/chat-utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GiphyPicker from "./GiphyPicker";
import EmojiPicker from "./EmojiPicker";
import type { IGif } from "@giphy/js-types";

interface ChatInputProps {
	draft: string;
	onDraftChange: (value: string) => void;
	onSend: () => void;
	onSendImage: (dataUrl: string) => void;
	onSendGif: (gif: IGif) => void;
	disabled: boolean;
	placeholder: string;
}

export default function ChatInput({
	draft,
	onDraftChange,
	onSend,
	onSendImage,
	onSendGif,
	disabled,
	placeholder,
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [showGiphy, setShowGiphy] = useState(false);
	const [showEmoji, setShowEmoji] = useState(false);

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
			<div className="flex items-center gap-1 mb-0.5">
				<Button
					variant="ghost"
					size="icon-sm"
					className="shrink-0"
					onClick={handleImageUpload}
					disabled={disabled}
					title="Send image"
				>
					<ImagePlus className="w-4 h-4" />
				</Button>

				<DropdownMenu open={showEmoji} onOpenChange={setShowEmoji}>
					<DropdownMenuTrigger>
						<Button
							variant="ghost"
							size="icon-sm"
							className="shrink-0"
							disabled={disabled}
							title="Send emoji"
							type="button"
						>
							<Smile className="w-4 h-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						side="top"
						sideOffset={8}
						className="p-0 border-none bg-transparent shadow-none w-[400px]"
					>
						<EmojiPicker
							onEmojiSelect={(emoji) => {
								onDraftChange(draft + emoji.emoji);
								setShowEmoji(false);
								textareaRef.current?.focus();
							}}
						/>
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu open={showGiphy} onOpenChange={setShowGiphy}>
					<DropdownMenuTrigger>
						<Button
							variant="ghost"
							size="icon-sm"
							className="shrink-0"
							disabled={disabled}
							title="Send GIF"
							type="button"
						>
							<Sticker className="w-4 h-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						side="top"
						sideOffset={8}
						className="p-0 border-none bg-transparent shadow-none w-[400px]"
					>
						<GiphyPicker
							width={400}
							onGifSelect={(gif) => {
								onSendGif(gif);
								setShowGiphy(false);
							}}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

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
