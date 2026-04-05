import { IMAGE_URL_RE } from "@/lib/chat-utils";

export default function MessageContent({ content }: { content: string }) {
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
					<p className="text-sm whitespace-pre-wrap break-words">{text}</p>
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

	return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
}
