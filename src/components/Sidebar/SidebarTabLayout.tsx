import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const sidebarPanelClass =
	"rounded-lg border border-(--sidebar-foreground)/10 bg-(--sidebar-foreground)/4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

export const sidebarRowClass =
	"rounded-lg border border-transparent transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-(--sidebar-foreground)/10 hover:bg-(--sidebar-foreground)/5 active:scale-[0.99] active:bg-(--sidebar-foreground)/7";

export const sidebarInputClass =
	"border-(--sidebar-foreground)/10 bg-(--sidebar-foreground)/5 text-sm shadow-none placeholder:text-muted-foreground/55 focus-visible:border-(--sidebar-ring) focus-visible:ring-(--sidebar-ring)/25";

export function SidebarTabRoot({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn("flex min-h-full flex-col gap-4 pb-4", className)}
			{...props}
		/>
	);
}

export function SidebarTabHeader({
	title,
	count,
	action,
	className,
}: {
	title: string;
	count?: number;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"sticky top-0 z-50 -mx-3 flex min-h-12 items-center justify-between gap-3 bg-sidebar px-3 py-2.5 shadow-[0_1px_0_color-mix(in_oklab,var(--sidebar-foreground)_10%,transparent)]",
				className,
			)}
		>
			<div className="flex min-w-0 items-center gap-2">
				<h2 className="truncate text-[0.6875rem] font-mono font-semibold uppercase leading-none tracking-[0.2em] text-muted-foreground">
					{title}
				</h2>
				{typeof count === "number" && (
					<SidebarCountBadge>{count}</SidebarCountBadge>
				)}
			</div>
			{action && (
				<div className="flex shrink-0 items-center gap-1">{action}</div>
			)}
		</div>
	);
}

export function SidebarSection({
	title,
	count,
	action,
	children,
	className,
}: {
	title?: string;
	count?: number;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("space-y-3", className)}>
			{title && (
				<div className="flex items-center justify-between gap-3 px-1">
					<div className="flex min-w-0 items-center gap-2">
						<h3 className="truncate text-[0.625rem] font-mono font-semibold uppercase leading-none tracking-[0.18em] text-muted-foreground/70">
							{title}
						</h3>
						{typeof count === "number" && (
							<SidebarCountBadge muted>{count}</SidebarCountBadge>
						)}
					</div>
					{action}
				</div>
			)}
			{children}
		</section>
	);
}

export function SidebarPanel({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn(sidebarPanelClass, className)} {...props} />;
}

export function SidebarCountBadge({
	children,
	muted,
}: {
	children: ReactNode;
	muted?: boolean;
}) {
	return (
		<span
			className={cn(
				"inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1.5 text-[0.5625rem] font-mono font-semibold leading-none tabular-nums",
				muted
					? "border-(--sidebar-foreground)/10 bg-(--sidebar-foreground)/4 text-muted-foreground/70"
					: "border-(--sidebar-primary)/20 bg-(--sidebar-primary)/10 text-(--sidebar-primary)",
			)}
		>
			{children}
		</span>
	);
}

export function SidebarEmptyState({
	title,
	children,
	className,
}: {
	title: string;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				sidebarPanelClass,
				"px-3 py-4 text-center text-muted-foreground",
				className,
			)}
		>
			<p className="text-sm font-medium text-foreground/80">{title}</p>
			{children && (
				<p className="mx-auto mt-1 max-w-52 text-xs leading-relaxed">
					{children}
				</p>
			)}
		</div>
	);
}
