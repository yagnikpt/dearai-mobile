import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useReducer } from "react";
import { Platform } from "react-native";

// Storage keys
export const STORAGE_KEYS = {
	ACCESS_TOKEN: "accessToken",
	REFRESH_TOKEN: "refreshToken",
	USER_EMAIL: "userEmail",
} as const;

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

/**
 * Decode JWT token payload without verification
 * Used for reading expiration time
 */
export function decodeJWT(token: string): {
	exp?: number;
	sub?: string;
	[key: string]: unknown;
} | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;

		const payload = parts[1];
		// Base64 URL decode
		const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split("")
				.map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
				.join(""),
		);

		return JSON.parse(jsonPayload);
	} catch (e) {
		console.error("Failed to decode JWT:", e);
		return null;
	}
}

/**
 * Check if a JWT token is expired or about to expire
 * @param token JWT token string
 * @param bufferSeconds Seconds before actual expiration to consider it expired (default 60s)
 */
export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
	const decoded = decodeJWT(token);
	if (!decoded || !decoded.exp) return true;

	const expirationTime = decoded.exp * 1000; // Convert to milliseconds
	const currentTime = Date.now();
	const bufferTime = bufferSeconds * 1000;

	return currentTime >= expirationTime - bufferTime;
}

/**
 * Get time until token expires in milliseconds
 * Returns 0 if token is already expired or invalid
 */
export function getTokenExpirationTime(token: string): number {
	const decoded = decodeJWT(token);
	if (!decoded || !decoded.exp) return 0;

	const expirationTime = decoded.exp * 1000;
	const currentTime = Date.now();
	const timeUntilExpiration = expirationTime - currentTime;

	return timeUntilExpiration > 0 ? timeUntilExpiration : 0;
}

/**
 * Clear all auth-related storage
 */
export async function clearAuthStorage(): Promise<void> {
	await Promise.all([
		setStorageItemAsync(STORAGE_KEYS.ACCESS_TOKEN, null),
		setStorageItemAsync(STORAGE_KEYS.REFRESH_TOKEN, null),
		setStorageItemAsync(STORAGE_KEYS.USER_EMAIL, null),
	]);
}
