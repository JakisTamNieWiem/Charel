import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const processAvatarImage = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = (event) => {
			const img = new Image();
			img.onload = () => {
				// 1. Create a canvas
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");
				if (!ctx) return reject("Could not get canvas context");

				// 2. Set target size
				canvas.width = 256;
				canvas.height = 256;

				// 3. Calculate cropping (to center the image as a square)
				const size = Math.min(img.width, img.height);
				const startX = (img.width - size) / 2;
				const startY = (img.height - size) / 2;

				// 4. Draw image to canvas (crop & resize)
				// drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight)
				ctx.drawImage(img, startX, startY, size, size, 0, 0, 256, 256);

				// 5. Export to highly compressed base64 WebP (0.8 quality)
				const base64String = canvas.toDataURL("image/webp", 0.8);
				resolve(base64String);
			};
			img.onerror = (err) => reject(err);

			// Load the image source
			img.src = event.target?.result as string;
		};
		reader.onerror = (err) => reject(err);

		// Read the file as a Data URL
		reader.readAsDataURL(file);
	});
};
