import { IMAGE_URL_RE } from "@/lib/chat-utils";
import { Emoji, EmojiStyle } from "emoji-picker-react";
import type { ReactNode } from "react";

const EMOJI_RE =
	/(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

function emojiToUnified(emoji: string): string {
	return [...emoji].map((c) => c.codePointAt(0)!.toString(16)).join("-");
}

function renderWithEmojis(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let lastIndex = 0;

	for (const match of text.matchAll(EMOJI_RE)) {
		if (match.index! > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}
		parts.push(
			<Emoji
				key={match.index}
				unified={emojiToUnified(match[0])}
				emojiStyle={EmojiStyle.TWITTER}
				size={18}
			/>,
		);
		lastIndex = match.index! + match[0].length;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts;
}

export default function MessageContent({ content }: { content: string }) {
	const systemMatch = content.match(/^\[system\](.*)\[\/system\]$/s);
	if (systemMatch) {
		return (
			<p className="text-xs text-muted-foreground italic">{systemMatch[1]}</p>
		);
	}

	const imgMatch = content.match(/^\[img\](.*)\[\/img\]$/s);
	if (imgMatch) {
		return (
			<img
				src={imgMatch[1]}
				alt="Image"
				className="max-w-sm max-h-72 rounded-lg mt-1"
			/>
		);
	}

	const imageUrls = content.match(IMAGE_URL_RE);
	if (imageUrls) {
		const text = content.replace(IMAGE_URL_RE, "").trim();
		return (
			<div>
				{text && (
					<p className="text-sm whitespace-pre-wrap wrap-break-word">
						{renderWithEmojis(text)}
					</p>
				)}
				{imageUrls.map((url) => (
					<img
						key={url}
						src={url}
						alt="Embedded"
						className="max-w-sm max-h-72 rounded-lg mt-1"
						onError={(e) => {
							const a = document.createElement("a");
							a.href = url;
							a.target = "_blank";
							a.rel = "noopener noreferrer";
							a.className = "text-sm text-blue-400 underline break-all";
							a.textContent = url;
							e.currentTarget.replaceWith(a);
						}}
					/>
				))}
			</div>
		);
	}

	return (
		<p className="text-sm whitespace-pre-wrap wrap-break-word flex justify-start!">
			{renderWithEmojis(content)}
		</p>
	);
}
