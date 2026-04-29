import { Container, Graphics } from "pixi.js";
import type { PixiScene } from "@/lib/pixi-runtime";

const root = new Container({ label: "vtt-scene" });
const grid = new Graphics();

root.addChild(grid);

function drawGrid(width: number, height: number) {
	const spacing = 64;
	const lineColor = 0xffffff;

	grid.clear();
	grid.rect(0, 0, width, height).fill({ color: 0x05070a, alpha: 1 });

	for (let x = 0; x <= width; x += spacing) {
		grid
			.moveTo(x, 0)
			.lineTo(x, height)
			.stroke({ color: lineColor, alpha: 0.08, width: 1 });
	}

	for (let y = 0; y <= height; y += spacing) {
		grid
			.moveTo(0, y)
			.lineTo(width, y)
			.stroke({ color: lineColor, alpha: 0.08, width: 1 });
	}
}

export const vttScene: PixiScene = {
	id: "vtt",
	root,
	resize: drawGrid,
};
