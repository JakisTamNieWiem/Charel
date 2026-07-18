import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type SubscriptionCallback = (status: string, error?: Error) => void;

const mocks = vi.hoisted(() => ({
	auth: {
		loading: false,
		session: {
			access_token: "token-1",
			user: { id: "user-1" },
		} as { access_token: string; user: { id: string } } | null,
	},
	clear: vi.fn(),
	importData: vi.fn(),
	pause: vi.fn(),
	queryClient: {
		invalidateQueries: vi.fn(),
	},
	removeChannel: vi.fn(),
	resume: vi.fn(),
	setState: vi.fn(),
	setSyncState: vi.fn(),
	subscriptionCallback: undefined as SubscriptionCallback | undefined,
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => mocks.queryClient,
}));

vi.mock("@/context/AuthProvider", () => ({
	useAuth: () => mocks.auth,
}));

vi.mock("@/lib/supabase", () => {
	type MockChannel = {
		on: () => MockChannel;
		subscribe: (callback: SubscriptionCallback) => MockChannel;
	};
	const channel = {} as MockChannel;
	channel.on = () => channel;
	channel.subscribe = (callback) => {
		mocks.subscriptionCallback = callback;
		return channel;
	};

	return {
		supabase: {
			channel: vi.fn(() => channel),
			from: vi.fn(() => ({
				select: vi.fn().mockResolvedValue({ data: [], error: null }),
			})),
			removeChannel: mocks.removeChannel,
		},
	};
});

vi.mock("@/store/useGraphStore", () => ({
	useGraphStore: {
		getState: () => ({
			importData: mocks.importData,
			setSyncState: mocks.setSyncState,
		}),
		setState: mocks.setState,
		temporal: {
			getState: () => ({
				clear: mocks.clear,
				pause: mocks.pause,
				resume: mocks.resume,
			}),
		},
	},
}));

function RealtimeSyncProbe() {
	useRealtimeSync();
	return null;
}

describe("useRealtimeSync", () => {
	beforeEach(() => {
		mocks.auth.loading = false;
		mocks.auth.session = {
			access_token: "token-1",
			user: { id: "user-1" },
		};
		mocks.subscriptionCallback = undefined;
	});

	it("keeps the current sync when the same user's token refreshes", async () => {
		const { rerender } = render(<RealtimeSyncProbe />);

		await waitFor(() => expect(mocks.importData).toHaveBeenCalledOnce());
		mocks.auth.session = {
			access_token: "token-2",
			user: { id: "user-1" },
		};
		rerender(<RealtimeSyncProbe />);

		expect(mocks.importData).toHaveBeenCalledOnce();
		expect(mocks.removeChannel).not.toHaveBeenCalled();
		expect(
			mocks.setSyncState.mock.calls.filter(
				([status, options]) =>
					status === "syncing" && options?.initialized === false,
			),
		).toHaveLength(1);
	});

	it("restarts sync when the authenticated user changes", async () => {
		const { rerender } = render(<RealtimeSyncProbe />);

		await waitFor(() => expect(mocks.importData).toHaveBeenCalledOnce());
		mocks.auth.session = {
			access_token: "token-2",
			user: { id: "user-2" },
		};
		rerender(<RealtimeSyncProbe />);

		await waitFor(() => expect(mocks.importData).toHaveBeenCalledTimes(2));
		expect(mocks.removeChannel).toHaveBeenCalledOnce();
		expect(
			mocks.setSyncState.mock.calls.filter(
				([status, options]) =>
					status === "syncing" && options?.initialized === false,
			),
		).toHaveLength(2);
	});

	it("recovers the sync status after a transient realtime error", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		render(<RealtimeSyncProbe />);

		await waitFor(() => expect(mocks.importData).toHaveBeenCalledOnce());
		const connectionError = new Error("Heartbeat timed out");
		act(() => {
			mocks.subscriptionCallback?.("TIMED_OUT", connectionError);
		});

		expect(consoleError).toHaveBeenCalledWith(
			"Realtime subscription failed:",
			"TIMED_OUT",
			connectionError,
		);
		expect(mocks.setSyncState).toHaveBeenLastCalledWith("error", {
			error: "Heartbeat timed out",
			initialized: true,
		});

		act(() => {
			mocks.subscriptionCallback?.("SUBSCRIBED");
		});
		expect(mocks.setSyncState).toHaveBeenLastCalledWith("connected", {
			initialized: true,
		});
	});
});
