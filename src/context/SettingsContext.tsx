import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const SETTINGS_STORAGE_KEY = "@dearai/settings";

export type AppSettings = {
	useCameraEmotionDetection: boolean;
	playAmbientSounds: boolean;
};

type SettingsContextType = {
	settings: AppSettings;
	isLoading: boolean;
	updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
};

const DEFAULT_SETTINGS: AppSettings = {
	useCameraEmotionDetection: false,
	playAmbientSounds: false,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

function isAppSettings(value: unknown): value is Partial<AppSettings> {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const settings = value as Record<string, unknown>;
	return (
		(settings.useCameraEmotionDetection === undefined ||
			typeof settings.useCameraEmotionDetection === "boolean") &&
		(settings.playAmbientSounds === undefined ||
			typeof settings.playAmbientSounds === "boolean")
	);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
	const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function loadSettings() {
			try {
				const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
				if (storedSettings) {
					const parsedSettings: unknown = JSON.parse(storedSettings);
					if (isAppSettings(parsedSettings)) {
						setSettings((current) => ({ ...current, ...parsedSettings }));
					}
				}
			} catch (error) {
				console.warn("Unable to load app settings:", error);
			} finally {
				setIsLoading(false);
			}
		}

		loadSettings();
	}, []);

	const updateSettings = useCallback(
		async (updates: Partial<AppSettings>) => {
			const nextSettings = { ...settings, ...updates };
			setSettings(nextSettings);

			try {
				await AsyncStorage.setItem(
					SETTINGS_STORAGE_KEY,
					JSON.stringify(nextSettings),
				);
			} catch (error) {
				console.warn("Unable to save app settings:", error);
			}
		},
		[settings],
	);

	const value = useMemo(
		() => ({ settings, isLoading, updateSettings }),
		[isLoading, settings, updateSettings],
	);

	return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
	const context = useContext(SettingsContext);
	if (!context) {
		throw new Error("useSettings must be used within a SettingsProvider");
	}
	return context;
}
