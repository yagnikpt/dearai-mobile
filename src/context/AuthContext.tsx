import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	GoogleOneTapSignIn,
	isNoSavedCredentialFoundResponse,
	isSuccessResponse,
} from "react-native-nitro-google-signin";

import { setAuthFailureCallback } from "@/lib/api";
import {
	clearAuthStorage,
	getStorageItemAsync,
	getUserData,
	STORAGE_KEYS,
	setStorageItemAsync,
	setUserData,
} from "@/lib/auth";
import type { AuthContextType, StoredUser } from "@/lib/types/auth";

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export function useSession() {
	const { session, isLoading } = useAuth();
	return {
		session,
		isLoading,
		isAuthenticated: !!session,
	};
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<string | null>(null);
	const [user, setUser] = useState<StoredUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Load persisted session and user data on mount
	useEffect(() => {
		async function loadSession() {
			try {
				const [idToken, userData] = await Promise.all([
					getStorageItemAsync(STORAGE_KEYS.ID_TOKEN),
					getUserData(),
				]);
				setSession(idToken);
				setUser(userData);
			} catch (e) {
				console.error("Failed to load session:", e);
			} finally {
				setIsLoading(false);
			}
		}
		loadSession();
	}, []);

	const signIn = useCallback(async (): Promise<void> => {
		await GoogleOneTapSignIn.checkPlayServices();

		let response = await GoogleOneTapSignIn.signIn();

		if (isNoSavedCredentialFoundResponse(response)) {
			response = await GoogleOneTapSignIn.createAccount();
		}
		if (isNoSavedCredentialFoundResponse(response)) {
			response = await GoogleOneTapSignIn.presentExplicitSignIn();
		}

		if (isSuccessResponse(response)) {
			const { idToken, user: googleUser } = response.data;

			console.log(idToken, googleUser);

			const storedUser: StoredUser = {
				id: googleUser.id,
				full_name: googleUser.name ?? googleUser.email ?? "",
				email: googleUser.email ?? "",
				photo: googleUser.photo,
			};

			await Promise.all([
				setStorageItemAsync(STORAGE_KEYS.ID_TOKEN, idToken),
				setUserData(storedUser),
			]);
		}
	}, []);

	const signOut = useCallback(async (): Promise<void> => {
		try {
			await GoogleOneTapSignIn.signOut();
		} catch (e) {
			console.error("Google sign-out failed:", e);
		}

		await clearAuthStorage();
		setSession(null);
		setUser(null);
	}, []);

	// Register the auth failure callback used by the API client (401 fallback)
	useEffect(() => {
		setAuthFailureCallback(() => {
			setSession(null);
			setUser(null);
		});

		return () => {
			setAuthFailureCallback(() => {});
		};
	}, []);

	const value = useMemo<AuthContextType>(
		() => ({
			session,
			user,
			isLoading,
			signIn,
			signOut,
		}),
		[session, user, isLoading, signIn, signOut],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
