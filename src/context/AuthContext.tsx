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

import { api, authApi, setAuthFailureCallback } from "@/lib/api";
import {
	clearAuthStorage,
	getStorageItemAsync,
	getUserData,
	STORAGE_KEYS,
	setUserData,
	useStorageState,
} from "@/lib/auth";
import {
	MIN_REFRESH_DELAY_MS,
	TOKEN_REFRESH_BUFFER_SECONDS,
} from "@/lib/constants";
import { getTokenExpirationTime, isTokenExpired } from "@/lib/jwt";
import type {
	AuthContextType,
	RegisterRequest,
	StoredUser,
} from "@/lib/types/auth";

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
	const [[isLoadingAccessToken, accessToken], setAccessToken] = useStorageState(
		STORAGE_KEYS.ACCESS_TOKEN,
	);
	const [[isLoadingRefreshToken], setRefreshToken] = useStorageState(
		STORAGE_KEYS.REFRESH_TOKEN,
	);

	// User data state
	const [user, setUser] = useState<StoredUser | null>(null);
	const [isLoadingUser, setIsLoadingUser] = useState(true);

	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const isLoading =
		isLoadingAccessToken || isLoadingRefreshToken || isLoadingUser;

	// Load user data on mount
	useEffect(() => {
		getUserData()
			.then(setUser)
			.finally(() => setIsLoadingUser(false));
	}, []);

	const clearRefreshTimer = useCallback(() => {
		if (refreshTimerRef.current) {
			clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = null;
		}
	}, []);

	const scheduleTokenRefresh = useCallback(
		(token: string) => {
			clearRefreshTimer();

			const timeUntilExpiry = getTokenExpirationTime(token);
			const refreshIn = Math.max(
				timeUntilExpiry - TOKEN_REFRESH_BUFFER_SECONDS * 1000,
				MIN_REFRESH_DELAY_MS,
			);

			console.log(
				`Scheduling token refresh in ${Math.round(refreshIn / 1000)} seconds`,
			);

			refreshTimerRef.current = setTimeout(async () => {
				console.log("Proactively refreshing token...");
				try {
					const currentRefreshToken = await getStorageItemAsync(
						STORAGE_KEYS.REFRESH_TOKEN,
					);
					if (!currentRefreshToken) {
						console.log("No refresh token available, skipping refresh");
						return;
					}

					const response = await api.post("/auth/refresh", {
						refresh_token: currentRefreshToken,
					});

					const { access_token, refresh_token: newRefreshToken } =
						response.data;

					setAccessToken(access_token);
					setRefreshToken(newRefreshToken);

					console.log("Token refreshed successfully");
					scheduleTokenRefresh(access_token);
				} catch (error) {
					console.error("Proactive token refresh failed:", error);
				}
			}, refreshIn);
		},
		[clearRefreshTimer, setAccessToken, setRefreshToken],
	);

	const signIn = useCallback(
		async (email: string, password: string): Promise<void> => {
			const response = await authApi.login({ email, password });

			setAccessToken(response.access_token);
			setRefreshToken(response.refresh_token);

			try {
				const userResponse = await authApi.getMe();
				const storedUser: StoredUser = {
					id: userResponse.id,
					full_name: userResponse.full_name,
					email: userResponse.email,
				};
				await setUserData(storedUser);
				setUser(storedUser);
			} catch (error) {
				console.error("Failed to fetch user profile:", error);
			}

			scheduleTokenRefresh(response.access_token);
		},
		[setAccessToken, setRefreshToken, scheduleTokenRefresh],
	);

	const signUp = useCallback(
		async (data: RegisterRequest): Promise<void> => {
			await authApi.register(data);
			await signIn(data.email, data.password);
		},
		[signIn],
	);

	const signOut = useCallback(async (): Promise<void> => {
		clearRefreshTimer();

		try {
			const currentRefreshToken = await getStorageItemAsync(
				STORAGE_KEYS.REFRESH_TOKEN,
			);
			if (currentRefreshToken) {
				await authApi.logout(currentRefreshToken);
			}
		} catch (error) {
			console.error("Backend logout failed:", error);
		}

		await clearAuthStorage();

		setAccessToken(null);
		setRefreshToken(null);
		setUser(null);
	}, [clearRefreshTimer, setAccessToken, setRefreshToken]);

	// Set up auth failure callback
	useEffect(() => {
		setAuthFailureCallback(() => {
			clearRefreshTimer();
			setAccessToken(null);
			setRefreshToken(null);
			setUser(null);
		});

		return () => {
			setAuthFailureCallback(() => {});
		};
	}, [clearRefreshTimer, setAccessToken, setRefreshToken]);

	// Set up proactive refresh when access token changes
	useEffect(() => {
		if (accessToken && !isTokenExpired(accessToken)) {
			scheduleTokenRefresh(accessToken);
		}

		return () => {
			clearRefreshTimer();
		};
	}, [accessToken, scheduleTokenRefresh, clearRefreshTimer]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			clearRefreshTimer();
		};
	}, [clearRefreshTimer]);

	const value = useMemo<AuthContextType>(
		() => ({
			session: accessToken,
			user,
			isLoading,
			signIn,
			signUp,
			signOut,
		}),
		[accessToken, user, isLoading, signIn, signUp, signOut],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
