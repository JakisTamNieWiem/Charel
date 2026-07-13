import { useCallback, useEffect, useRef, useState } from "react";

type UseSvgPanZoomOptions = {
	svgSize: number;
	disabled?: boolean;
	onPanStart?: () => void;
};

export function useSvgPanZoom({
	svgSize,
	disabled = false,
	onPanStart,
}: UseSvgPanZoomOptions) {
	const groupRef = useRef<SVGGElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const panRef = useRef({ x: 0, y: 0 });
	const scaleRef = useRef(1);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const rafRef = useRef<number | null>(null);
	const isDraggingRef = useRef(false);
	const [isDragging, setIsDragging] = useState(false);

	const applyTransform = useCallback(() => {
		groupRef.current?.setAttribute(
			"transform",
			`translate(${panRef.current.x}, ${panRef.current.y}) scale(${scaleRef.current})`,
		);
	}, []);

	const center = useCallback(() => {
		const rect = stageRef.current?.getBoundingClientRect();
		if (!rect?.width) return;

		const rootFontSize =
			Number.parseFloat(
				window.getComputedStyle(document.documentElement).fontSize,
			) || 16;
		const leftBound =
			1.5 * rootFontSize +
			Math.max(
				0,
				Math.min(11.5 * rootFontSize, rect.width - 25 * rootFontSize),
			);
		const rightBound =
			rect.width +
			Math.max(0, Math.min(20 * rootFontSize, rect.width - 3 * rootFontSize));

		if (rightBound <= leftBound) {
			panRef.current = { x: 0, y: 0 };
		} else {
			const workspaceCenter = (leftBound + rightBound) / 2;
			const offsetPx = workspaceCenter - rect.width / 2 + rootFontSize * 2.5;
			panRef.current = { x: offsetPx * (svgSize / rect.width), y: 0 };
		}

		scaleRef.current = 1;
		applyTransform();
	}, [applyTransform, svgSize]);

	useEffect(() => {
		center();
	}, [center]);

	useEffect(() => {
		window.addEventListener("resize", center);
		return () => {
			window.removeEventListener("resize", center);
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		};
	}, [center]);

	const getPointerPosition = (event: React.PointerEvent) => {
		if (!svgRef.current) return { x: 0, y: 0 };
		const point = svgRef.current.createSVGPoint();
		point.x = event.clientX;
		point.y = event.clientY;
		return point.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
	};

	const stopDragging = () => {
		setIsDragging(false);
		isDraggingRef.current = false;
		if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		rafRef.current = null;
	};

	return {
		groupRef,
		stageRef,
		svgRef,
		isDragging,
		isDraggingRef,
		handleWheel: (event: React.WheelEvent) => {
			scaleRef.current = Math.max(
				0.2,
				Math.min(scaleRef.current - event.deltaY * 0.002, 4),
			);
			applyTransform();
		},
		handlePointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
			if (disabled) return;
			setIsDragging(true);
			isDraggingRef.current = true;
			onPanStart?.();
			event.currentTarget.setPointerCapture(event.pointerId);
			const point = getPointerPosition(event);
			dragStartRef.current = {
				x: point.x - panRef.current.x,
				y: point.y - panRef.current.y,
			};
		},
		handlePointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
			if (!isDraggingRef.current) return;
			const point = getPointerPosition(event);
			panRef.current = {
				x: point.x - dragStartRef.current.x,
				y: point.y - dragStartRef.current.y,
			};

			if (rafRef.current === null) {
				rafRef.current = requestAnimationFrame(() => {
					applyTransform();
					rafRef.current = null;
				});
			}
		},
		handlePointerUp: stopDragging,
		handlePointerCancel: stopDragging,
	};
}
