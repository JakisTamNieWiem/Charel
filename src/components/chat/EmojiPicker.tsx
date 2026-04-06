import EmojiPicker, { type EmojiClickData, EmojiStyle, Theme } from "emoji-picker-react";

interface EmojiPickerProps {
	onEmojiSelect: (emoji: EmojiClickData) => void;
}

export default function ChatEmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
	return (
		<div className="p-0 border border-white/10 rounded-lg shadow-xl" onKeyDown={(e) => e.stopPropagation()}>
			<EmojiPicker 
				onEmojiClick={onEmojiSelect} 
				theme={Theme.DARK}
				width="100%"
				height={400}
				emojiStyle={EmojiStyle.TWITTER}
				previewConfig={{ showPreview: false }}
			/>
		</div>
	);
}
