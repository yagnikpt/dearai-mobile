import { useAudioPlaylist, useAudioPlaylistStatus } from "expo-audio";
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
	require("@/assets/audio/marconi-union-weightless.mp3"),
	// require("@/assets/audio/weightless-part-2.mp3"),
	// require("@/assets/audio/weightless-part-3-marconi-union.mp3"),
	// require("@/assets/audio/weightless-part-4-marconi-union.mp3"),
	// require("@/assets/audio/marconi-union-weightless-part-5.mp3"),
	// require("@/assets/audio/weightless-part-6-marconi-union.mp3"),
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
	setTemporarilyPaused: (paused: boolean) => void;
};

const AmbientMusicContext = createContext<AmbientMusicContextType>({
	isPlaying: false,
	currentTrackIndex: 0,
	totalTracks: AMBIENT_TRACKS.length,
	setTemporarilyPaused: () => {},
});

// ─── Inner player component ───────────────────────────────────────────────────
// Separated so that hooks can be called unconditionally at the top level.
function AmbientPlaylistPlayer({
	onTrackChange,
	isTemporarilyPaused,
}: {
	onTrackChange: (index: number) => void;
	isTemporarilyPaused: boolean;
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
			if (!isTemporarilyPaused) {
				playlist.play();
			}
		}
	}, [status.isLoaded, playlist, isTemporarilyPaused]);

	// React to pause/play requests
	useEffect(() => {
		if (startedRef.current && status.isLoaded) {
			if (isTemporarilyPaused) {
				playlist.pause();
			} else {
				playlist.play();
			}
		}
	}, [isTemporarilyPaused, playlist, status.isLoaded]);

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
	const [isTemporarilyPaused, setTemporarilyPaused] = useState(false);

	const handleTrackChange = useCallback((index: number) => {
		setCurrentTrackIndex(index);
	}, []);

	return (
		<AmbientMusicContext.Provider
			value={{
				isPlaying: isEnabled && !isTemporarilyPaused,
				currentTrackIndex,
				totalTracks: AMBIENT_TRACKS.length,
				setTemporarilyPaused,
			}}
		>
			{isEnabled && (
				<AmbientPlaylistPlayer
					onTrackChange={handleTrackChange}
					isTemporarilyPaused={isTemporarilyPaused}
				/>
			)}
			{children}
		</AmbientMusicContext.Provider>
	);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAmbientMusic() {
	return useContext(AmbientMusicContext);
}
