import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import {
	useCallback,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
	normalizeCharacterStatus,
	type CharacterStatus,
} from "@/lib/character-status";
import { useChatStore } from "@/store/useChatStore";
import { useGraphStore } from "@/store/useGraphStore";

interface PresencePayload {
	characterId: string;
	userId: string;
	status: CharacterStatus;
	updatedAt: string;
}

interface CharacterPresenceContextValue {
	effectiveStatuses: Map<string, CharacterStatus>;
	getCharacterStatus: (
		characterId: string | null | undefined,
	) => CharacterStatus;
	isTrackingPresence: boolean;
	isUpdatingStatus: boolean;
	setCharacterStatus: (
		characterId: string,
		status: CharacterStatus,
	) => Promise<void>;
}

const CharacterPresenceContext =
	createContext<CharacterPresenceContextValue | null>(null);

async function syncTrackedPresence({
	channel,
	characterId,
	session,
	status,
	trackedCharacterRef,
}: {
	channel: RealtimeChannel;
	characterId: string | null;
	session: Session;
	status: CharacterStatus;
	trackedCharacterRef: { current: string | null };
}) {
	if (
		trackedCharacterRef.current &&
		trackedCharacterRef.current !== characterId
	) {
		await channel.untrack();
		trackedCharacterRef.current = null;
	}

	if (!characterId || status === "offline") {
		if (trackedCharacterRef.current) {
			await channel.untrack();
			trackedCharacterRef.current = null;
		}
		return;
	}

	await channel.track({
		characterId,
		userId: session.user.id,
		status,
		updatedAt: new Date().toISOString(),
	});
	trackedCharacterRef.current = characterId;
}

export function CharacterPresenceProvider({
	children,
	session,
}: {
	children: React.ReactNode;
	session: Session | null;
}) {
	const characters = useGraphStore((state) => state.characters);
	const activeSpeakerId = useChatStore((state) => state.activeSpeakerId);
	const [presenceState, setPresenceState] = useState<
		Record<string, PresencePayload[]>
	>({});
	const [isSubscribed, setIsSubscribed] = useState(false);
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
	const channelRef = useRef<RealtimeChannel | null>(null);
	const trackedCharacterRef = useRef<string | null>(null);

	const activeSpeaker = useMemo(
		() =>
			activeSpeakerId
				? (characters.find((character) => character.id === activeSpeakerId) ??
					null)
				: null,
		[characters, activeSpeakerId],
	);

	useEffect(() => {
		if (!session) {
			setPresenceState({});
			setIsSubscribed(false);
			trackedCharacterRef.current = null;
			return;
		}

		let cancelled = false;
		void supabase.realtime.setAuth(session.access_token);
		const channel = supabase.channel("presence:characters");
		channelRef.current = channel;

		const syncState = () => {
			if (cancelled) return;
			setPresenceState(channel.presenceState<PresencePayload>());
		};

		channel
			.on("presence", { event: "sync" }, syncState)
			.on("presence", { event: "join" }, syncState)
			.on("presence", { event: "leave" }, syncState)
			.subscribe((status) => {
				if (cancelled) return;
				const subscribed = status === "SUBSCRIBED";
				setIsSubscribed(subscribed);
				if (subscribed) {
					syncState();
				}
			});

		return () => {
			cancelled = true;
			setIsSubscribed(false);
			trackedCharacterRef.current = null;
			channelRef.current = null;
			void supabase.removeChannel(channel);
		};
	}, [session]);

	useEffect(() => {
		const channel = channelRef.current;
		if (!channel || !session || !isSubscribed) return;

		void syncTrackedPresence({
			channel,
			characterId: activeSpeaker?.id ?? null,
			session,
			status: normalizeCharacterStatus(activeSpeaker?.status),
			trackedCharacterRef,
		}).finally(() => {
			setPresenceState(channel.presenceState<PresencePayload>());
		});
	}, [activeSpeaker?.id, activeSpeaker?.status, isSubscribed, session]);

	const effectiveStatuses = useMemo(() => {
		const latestPresenceByCharacter = new Map<string, PresencePayload>();

		for (const metas of Object.values(presenceState)) {
			for (const meta of metas) {
				const current = latestPresenceByCharacter.get(meta.characterId);
				if (
					!current ||
					new Date(meta.updatedAt).getTime() >=
						new Date(current.updatedAt).getTime()
				) {
					latestPresenceByCharacter.set(meta.characterId, meta);
				}
			}
		}

		return new Map<string, CharacterStatus>(
			characters.map((character) => {
				const manualStatus = normalizeCharacterStatus(character.status);
				if (manualStatus === "offline") {
					return [character.id, "offline"];
				}

				return [
					character.id,
					(latestPresenceByCharacter.get(character.id)?.status ??
						"offline") as CharacterStatus,
				];
			}),
		);
	}, [characters, presenceState]);

	const setCharacterStatus = useCallback(
		async (characterId: string, status: CharacterStatus) => {
			const previousCharacters = useGraphStore.getState().characters;
			const previousCharacter = previousCharacters.find(
				(character) => character.id === characterId,
			);
			if (!previousCharacter) return;

			setIsUpdatingStatus(true);
			useGraphStore.setState({
				characters: previousCharacters.map((character) =>
					character.id === characterId ? { ...character, status } : character,
				),
			});

			const { error } = await supabase
				.from("Characters")
				.update({ status })
				.eq("id", characterId);

			if (error) {
				useGraphStore.setState({ characters: previousCharacters });
				toast.error("Could not update character status.");
				console.error("Error updating character status:", error);
				setIsUpdatingStatus(false);
				return;
			}

			if (
				session &&
				isSubscribed &&
				activeSpeakerId === characterId &&
				channelRef.current
			) {
				await syncTrackedPresence({
					channel: channelRef.current,
					characterId,
					session,
					status,
					trackedCharacterRef,
				});
				setPresenceState(channelRef.current.presenceState<PresencePayload>());
			}

			setIsUpdatingStatus(false);
		},
		[activeSpeakerId, isSubscribed, session],
	);

	const value = useMemo<CharacterPresenceContextValue>(
		() => ({
			effectiveStatuses,
			getCharacterStatus: (characterId) =>
				characterId
					? (effectiveStatuses.get(characterId) ?? "offline")
					: "offline",
			isTrackingPresence: isSubscribed,
			isUpdatingStatus,
			setCharacterStatus,
		}),
		[effectiveStatuses, isSubscribed, isUpdatingStatus, setCharacterStatus],
	);

	return (
		<CharacterPresenceContext.Provider value={value}>
			{children}
		</CharacterPresenceContext.Provider>
	);
}

export function useCharacterPresence() {
	const context = useContext(CharacterPresenceContext);
	if (!context) {
		throw new Error(
			"useCharacterPresence must be used within CharacterPresenceProvider",
		);
	}

	return context;
}
