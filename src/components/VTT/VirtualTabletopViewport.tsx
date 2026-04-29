import { useEffect, useRef } from "react";
import { sharedPixiRuntime } from "@/lib/pixi-runtime";
import { vttScene } from "@/lib/vtt-scene";

export default function VirtualTabletopViewport() {
	const hostRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const host = hostRef.current;

		if (!host) {
			return;
		}

		let disposed = false;
		let attached = false;
		let attachToken = 0;
		let resizeObserver: ResizeObserver | null = null;

		sharedPixiRuntime.attach(host).then((attachment) => {
			if (disposed) {
				sharedPixiRuntime.detach(host, attachment.token);
				return;
			}

			attached = true;
			attachToken = attachment.token;
			attachment.canvas.setAttribute("aria-label", "Virtual tabletop");
			sharedPixiRuntime.activateRoot(vttScene.id, vttScene.root);
			vttScene.activate?.(attachment);

			resizeObserver = new ResizeObserver((entries) => {
				const rect = entries[0].contentRect;
				const width = Math.max(rect.width, 1);
				const height = Math.max(rect.height, 1);
				const resolution = window.devicePixelRatio || 1;

				sharedPixiRuntime.resize(width, height, resolution);
				vttScene.resize?.(width, height, resolution);
				sharedPixiRuntime.render();
			});
			resizeObserver.observe(host);
		});

		return () => {
			disposed = true;
			resizeObserver?.disconnect();

			if (attached) {
				vttScene.deactivate?.();
				sharedPixiRuntime.deactivateRoot(vttScene.id);
				sharedPixiRuntime.detach(host, attachToken);
			}
		};
	}, []);

	return (
		<div className="relative h-full w-full overflow-hidden" ref={hostRef} />
	);
}
