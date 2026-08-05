import { setAudioModeAsync } from "expo-audio";
import type React from "react";
import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type AudioSessionContextType = {
	setVoiceSessionActive: (active: boolean) => void;
};

const AudioSessionContext = createContext<AudioSessionContextType | null>(null);

export function AudioSessionProvider({ children }: { children: React.ReactNode }) {
	const [isVoiceSessionActive, setVoiceSessionActive] = useState(false);
	const audioModeUpdateRef = useRef(Promise.resolve());

	useEffect(() => {
		const mode = {
			allowsRecording: isVoiceSessionActive,
			interruptionMode: "mixWithOthers",
			playsInSilentMode: true,
			shouldPlayInBackground: true,
			shouldRouteThroughEarpiece: false,
		} satisfies Parameters<typeof setAudioModeAsync>[0];

		audioModeUpdateRef.current = audioModeUpdateRef.current
			.catch(() => undefined)
			.then(() => setAudioModeAsync(mode))
			.catch((error) => {
				console.warn("Unable to configure the audio session:", error);
			});
	}, [isVoiceSessionActive]);

	const value = useMemo(
		() => ({ setVoiceSessionActive }),
		[setVoiceSessionActive],
	);

	return <AudioSessionContext.Provider value={value}>{children}</AudioSessionContext.Provider>;
}

export function useAudioSession() {
	const context = useContext(AudioSessionContext);
	if (!context) {
		throw new Error("useAudioSession must be used within an AudioSessionProvider");
	}
	return context;
}
