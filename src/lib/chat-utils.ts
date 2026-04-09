const MAX_IMG_SIZE = 800;
const IMAGE_URL_RE =
	/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?\S*)?/gi;

export { IMAGE_URL_RE };

export function resizeImage(file: File): Promise<string> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			let { width, height } = img;
			if (width > MAX_IMG_SIZE || height > MAX_IMG_SIZE) {
				const ratio = Math.min(MAX_IMG_SIZE / width, MAX_IMG_SIZE / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d");
			if (ctx) ctx.drawImage(img, 0, 0, width, height);
			resolve(canvas.toDataURL("image/webp", 0.8));
		};
		img.src = URL.createObjectURL(file);
	});
}

export function readFileAsDataURL(file: File): Promise<string> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.readAsDataURL(file);
	});
}

export function formatDateHeader(dateStr: string): string {
	const d = new Date(dateStr);
	const now = new Date();

	// Helper to check if two Dates represent the same calendar day in the local timezone
	const isSameDay = (date1: Date, date2: Date) => {
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	};

	// Check if it's Today
	if (isSameDay(d, now)) {
		return "Today";
	}

	// Calculate yesterday's date in the local timezone
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);

	// Check if it's Yesterday
	if (isSameDay(d, yesterday)) {
		return "Yesterday";
	}

	// Fallback to formatted string
	return d.toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
		year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
	});
}

export function isImageContent(content: string): boolean {
	return content.startsWith("[img]") || IMAGE_URL_RE.test(content);
}

export function getMessagePreview(content: string): string {
	if (content.startsWith("[img]")) return "📷 Image";
	if (/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?\S*)?/i.test(content))
		return "📷 Image";
	return content.length > 30 ? `${content.slice(0, 30)}...` : content;
}
