import {
	signOut as firebaseSignOut,
	GoogleAuthProvider,
	getAuth,
	getIdToken,
	onIdTokenChanged,
	signInWithCredential,
} from "@react-native-firebase/auth";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	GoogleOneTapSignIn,
	isErrorWithCode,
	isNoSavedCredentialFoundResponse,
	isSuccessResponse,
	statusCodes,
} from "react-native-nitro-google-signin";

import { setAuthFailureCallback } from "@/lib/api";
import {
	clearAuthStorage,
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

/**
 * Sign a Google credential into Firebase and return the Firebase ID token.
 */
async function firebaseSignInWithGoogle(
	idToken: string,
	accessToken: string,
): Promise<{
	firebaseToken: string;
	firebaseUser: ReturnType<typeof getAuth>["currentUser"];
}> {
	const googleCredential = GoogleAuthProvider.credential(idToken, accessToken);
	const userCredential = await signInWithCredential(
		getAuth(),
		googleCredential,
	);
	const firebaseToken = await getIdToken(userCredential.user);
	return { firebaseToken, firebaseUser: userCredential.user };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<string | null>(null);
	const [user, setUser] = useState<StoredUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Keep a ref to the latest Firebase User for the 401 refresh handler.
	const firebaseUserRef = useRef(getAuth().currentUser);

	// Subscribe to Firebase's token changes. This fires:
	//   - on mount (current user or null)
	//   - when Firebase auto-refreshes the ID token (~every hour)
	//   - after signInWithCredential / signOut
	useEffect(() => {
		const unsubscribe = onIdTokenChanged(getAuth(), async (firebaseUser) => {
			firebaseUserRef.current = firebaseUser;

			if (!firebaseUser) {
				// Firebase has no active session — ensure local state is clean.
				setSession(null);
				setUser(null);
				await clearAuthStorage();
				setIsLoading(false);
				return;
			}

			try {
				// Get (or auto-refresh) the Firebase ID token.
				const firebaseToken = await getIdToken(firebaseUser);

				// Keep SecureStore in sync so api.ts interceptor can read it.
				await setStorageItemAsync(STORAGE_KEYS.ID_TOKEN, firebaseToken);
				setSession(firebaseToken);

				// Load / update the stored user profile.
				const cachedUser = await getUserData();
				setUser(cachedUser);
			} catch (e) {
				console.error("Failed to get Firebase ID token:", e);
				setSession(null);
				setUser(null);
			} finally {
				setIsLoading(false);
			}
		});

		return unsubscribe;
	}, []);

	// On mount: attempt a silent token restore via Google's native session.
	// If Google has no cached credential, Firebase's onIdTokenChanged will
	// already have fired with null (no session) and set isLoading=false.
	useEffect(() => {
		async function restoreSession() {
			try {
				// Load cached user profile immediately for fast UI rendering.
				const cachedUser = await getUserData();
				setUser(cachedUser);

				// getTokens() is purely silent — no UI shown. Throws
				// SIGN_IN_REQUIRED when there is no cached Google session.
				const { idToken, accessToken } = await GoogleOneTapSignIn.getTokens();

				// Exchange Google tokens for a Firebase session. The
				// onIdTokenChanged listener will pick up the new user and
				// update session state automatically.
				await firebaseSignInWithGoogle(idToken, accessToken);
			} catch (e) {
				if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED) {
					// No cached Google session — Firebase is also signed out,
					// onIdTokenChanged will have already handled null state.
				} else {
					console.error("Failed to restore session:", e);
					setSession(null);
					setUser(null);
					setIsLoading(false);
				}
			}
		}

		// Only attempt restore if Firebase has no current user (cold start).
		if (!getAuth().currentUser) {
			restoreSession();
		}
	}, []);

	const signIn = useCallback(async (): Promise<void> => {
		// Try silent sign-in first (uses saved credential).
		let response = await GoogleOneTapSignIn.signIn();

		// No saved credential — show full account picker.
		if (isNoSavedCredentialFoundResponse(response)) {
			response = await GoogleOneTapSignIn.createAccount();
		}

		if (!isSuccessResponse(response) || !response.data) {
			// User cancelled or unexpected response — do nothing.
			return;
		}

		const { idToken, user: googleUser } = response.data;

		const googleCredential = GoogleAuthProvider.credential(idToken);
		const { firebaseToken } = await firebaseSignInWithGoogle(
			googleCredential.idToken!,
			googleCredential.accessToken!,
		);

		// Persist the user profile for fast rendering on next launch.
		const storedUser: StoredUser = {
			id: googleUser.id,
			full_name: googleUser.name ?? googleUser.email ?? "",
			email: googleUser.email ?? "",
			photo: googleUser.photo,
		};
		await setUserData(storedUser);
		setUser(storedUser);

		// onIdTokenChanged handles setting session, but we set it directly
		// here too so the UI transitions immediately without waiting.
		await setStorageItemAsync(STORAGE_KEYS.ID_TOKEN, firebaseToken);
		setSession(firebaseToken);
	}, []);

	const signOut = useCallback(async (): Promise<void> => {
		try {
			await GoogleOneTapSignIn.signOut();
		} catch (e) {
			console.error("Google sign-out failed:", e);
		}

		// Firebase sign-out triggers onIdTokenChanged(null) which clears state.
		await firebaseSignOut(getAuth());
		await clearAuthStorage();
	}, []);

	// Register the API client's 401 recovery callback.
	// On 401, force-refresh the Firebase token (the SDK handles the
	// underlying OAuth refresh automatically).
	useEffect(() => {
		setAuthFailureCallback(async () => {
			const user = firebaseUserRef.current;
			if (user) {
				try {
					const freshToken = await getIdToken(user, /* forceRefresh */ true);
					await setStorageItemAsync(STORAGE_KEYS.ID_TOKEN, freshToken);
					setSession(freshToken);
					return;
				} catch {
					// Force-refresh failed — fall through to sign out.
				}
			}
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
