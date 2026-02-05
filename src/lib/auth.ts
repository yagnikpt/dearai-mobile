import { STORAGE_KEYS } from "./constants";
import { getStorageItemAsync, setStorageItemAsync } from "./storage";
import type { StoredUser } from "./types/auth";

// Re-export commonly used items for convenience
export { STORAGE_KEYS } from "./constants";
export {
	decodeJWT,
	getTokenExpirationTime,
	isTokenExpired,
} from "./jwt";
export {
	getStorageItemAsync,
	setStorageItemAsync,
	useStorageState,
} from "./storage";

/**
 * Store user data as JSON
 */
export async function setUserData(user: StoredUser | null): Promise<void> {
	if (user === null) {
		await setStorageItemAsync(STORAGE_KEYS.USER_DATA, null);
	} else {
		await setStorageItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
	}
}

/**
 * Get stored user data
 */
export async function getUserData(): Promise<StoredUser | null> {
	const data = await getStorageItemAsync(STORAGE_KEYS.USER_DATA);
	if (!data) return null;

	try {
		return JSON.parse(data) as StoredUser;
	} catch (e) {
		console.error("Failed to parse stored user data:", e);
		return null;
	}
}

/**
 * Clear all auth-related storage
 */
export async function clearAuthStorage(): Promise<void> {
	await Promise.all([
		setStorageItemAsync(STORAGE_KEYS.ACCESS_TOKEN, null),
		setStorageItemAsync(STORAGE_KEYS.REFRESH_TOKEN, null),
		setStorageItemAsync(STORAGE_KEYS.USER_DATA, null),
	]);
}
