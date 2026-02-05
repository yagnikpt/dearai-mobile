import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useReducer } from "react";
import { Platform } from "react-native";

// Types
type UseStateHook<T> = [[boolean, T | null], (value: T | null) => void];

function useAsyncState<T>(
	initialValue: [boolean, T | null] = [true, null],
): UseStateHook<T> {
	return useReducer(
		(
			state: [boolean, T | null],
			action: T | null = null,
		): [boolean, T | null] => [false, action],
		initialValue,
	) as UseStateHook<T>;
}

/**
 * Set a value in secure storage (native) or localStorage (web)
 */
export async function setStorageItemAsync(
	key: string,
	value: string | null,
): Promise<void> {
	if (Platform.OS === "web") {
		try {
			if (value === null) {
				localStorage.removeItem(key);
			} else {
				localStorage.setItem(key, value);
			}
		} catch (e) {
			console.error("Local storage is unavailable:", e);
		}
	} else {
		if (value == null) {
			await SecureStore.deleteItemAsync(key);
		} else {
			await SecureStore.setItemAsync(key, value);
		}
	}
}

/**
 * Get a value from secure storage (native) or localStorage (web)
 */
export async function getStorageItemAsync(key: string): Promise<string | null> {
	if (Platform.OS === "web") {
		try {
			if (typeof localStorage !== "undefined") {
				return localStorage.getItem(key);
			}
		} catch (e) {
			console.error("Local storage is unavailable:", e);
		}
		return null;
	} else {
		return await SecureStore.getItemAsync(key);
	}
}

/**
 * Hook to manage a value in secure storage with loading state
 * Returns [[isLoading, value], setValue]
 */
export function useStorageState(key: string): UseStateHook<string> {
	const [state, setState] = useAsyncState<string>();

	// Load initial value
	useEffect(() => {
		if (Platform.OS === "web") {
			try {
				if (typeof localStorage !== "undefined") {
					setState(localStorage.getItem(key));
				}
			} catch (e) {
				console.error("Local storage is unavailable:", e);
			}
		} else {
			SecureStore.getItemAsync(key).then((value: string | null) => {
				setState(value);
			});
		}
	}, [key, setState]);

	// Set value both in state and storage
	const setValue = useCallback(
		(value: string | null) => {
			setState(value);
			setStorageItemAsync(key, value);
		},
		[key, setState],
	);

	return [state, setValue];
}
