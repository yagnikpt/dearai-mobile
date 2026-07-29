import {
	setIsAudioActiveAsync,
	useAudioPlaylist,
	useAudioPlaylistStatus,
} from "expo-audio";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useSettings } from "@/context/SettingsContext";

// ─── Audio track registry ────────────────────────────────────────────────────
// All ambient tracks are statically required so Metro bundles them correctly.
const AMBIENT_TRACKS = [
	require("../assets/audio/marconi-union-weightless.mp3"),
	require("../assets/audio/weightless-part-2.mp3"),
	require("../assets/audio/weightless-part-3-marconi-union.mp3"),
	require("../assets/audio/weightless-part-4-marconi-union.mp3"),
	require("../assets/audio/marconi-union-weightless-part-5.mp3"),
	require("../assets/audio/weightless-part-6-marconi-union.mp3"),
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

// ─── Context ──────────────────────────────────────────────────────────────────
type AmbientMusicContextType = {
	isPlaying: boolean;
	currentTrackIndex: number;
	totalTracks: number;
};

const AmbientMusicContext = createContext<AmbientMusicContextType>({
	isPlaying: false,
	currentTrackIndex: 0,
	totalTracks: AMBIENT_TRACKS.length,
});

// ─── Inner player component ───────────────────────────────────────────────────
// Separated so that hooks can be called unconditionally at the top level.
function AmbientPlaylistPlayer({
	onTrackChange,
}: {
	onTrackChange: (index: number) => void;
}) {
	const [shuffledSources] = useState(() => shuffleArray(AMBIENT_TRACKS));

	const playlist = useAudioPlaylist({
		sources: shuffledSources,
		loop: "all",
	});
	const status = useAudioPlaylistStatus(playlist);

	// Track whether we've started initial playback
	const startedRef = useRef(false);

	// Start playback as soon as the first track loads
	useEffect(() => {
		if (status.isLoaded && !startedRef.current) {
			startedRef.current = true;
			playlist.play();
		}
	}, [status.isLoaded, playlist]);

	// Notify parent about track changes
	useEffect(() => {
		if (status.currentIndex !== undefined) {
			onTrackChange(status.currentIndex);
		}
	}, [status.currentIndex, onTrackChange]);

	return null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AmbientMusicProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { settings } = useSettings();
	const isEnabled = settings.playAmbientSounds;
	const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

	const handleTrackChange = useCallback((index: number) => {
		setCurrentTrackIndex(index);
	}, []);

	// Configure the audio session so ambient music plays even in silent mode
	// and mixes with other audio (e.g. voice calls, system sounds).
	useEffect(() => {
		if (isEnabled) {
			setIsAudioActiveAsync(true).catch((err) => {
				console.warn("[AmbientMusic] Failed to activate audio session:", err);
			});
		} else {
			setIsAudioActiveAsync(false).catch((err) => {
				console.warn("[AmbientMusic] Failed to deactivate audio session:", err);
			});
		}
	}, [isEnabled]);

	return (
		<AmbientMusicContext.Provider
			value={{
				isPlaying: isEnabled,
				currentTrackIndex,
				totalTracks: AMBIENT_TRACKS.length,
			}}
		>
			{isEnabled && <AmbientPlaylistPlayer onTrackChange={handleTrackChange} />}
			{children}
		</AmbientMusicContext.Provider>
	);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAmbientMusic() {
	return useContext(AmbientMusicContext);
}
