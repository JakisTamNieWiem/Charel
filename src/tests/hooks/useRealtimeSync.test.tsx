import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type SubscriptionCallback = (status: string, error?: Error) => void;

const mocks = vi.hoisted(() => ({
	clear: vi.fn(),
	importData: vi.fn(),
	invalidateQueries: vi.fn(),
	pause: vi.fn(),
	removeChannel: vi.fn(),
	resume: vi.fn(),
	setState: vi.fn(),
	setSyncState: vi.fn(),
	subscriptionCallback: undefined as SubscriptionCallback | undefined,
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/context/AuthProvider", () => ({
	useAuth: () => ({
		loading: false,
		session: { user: { id: "user-1" } },
	}),
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
		mocks.subscriptionCallback = undefined;
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
