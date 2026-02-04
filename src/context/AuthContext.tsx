import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
} from "react";
import {
	authApi,
	type RegisterRequest,
	setAuthFailureCallback,
} from "@/lib/api";
import {
	clearAuthStorage,
	getStorageItemAsync,
	getTokenExpirationTime,
	isTokenExpired,
	STORAGE_KEYS,
	useStorageState,
} from "@/lib/auth";

interface AuthContextType {
	// Auth state
	session: string | null;
	userEmail: string | null;
	isLoading: boolean;

	// Auth actions
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (data: RegisterRequest) => Promise<void>;
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

// Hook to check if user is authenticated
export function useSession() {
	const { session, isLoading } = useAuth();
	return {
		session,
		isLoading,
		isAuthenticated: !!session,
	};
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	// Storage-backed state for tokens and email
	const [[isLoadingAccessToken, accessToken], setAccessToken] = useStorageState(
		STORAGE_KEYS.ACCESS_TOKEN,
	);
	const [[isLoadingRefreshToken], setRefreshToken] = useStorageState(
		STORAGE_KEYS.REFRESH_TOKEN,
	);
	const [[isLoadingEmail, userEmail], setUserEmail] = useStorageState(
		STORAGE_KEYS.USER_EMAIL,
	);

	// Ref to store the proactive refresh timer
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Combined loading state
	const isLoading =
		isLoadingAccessToken || isLoadingRefreshToken || isLoadingEmail;

	/**
	 * Schedule a proactive token refresh before expiration
	 */
	const scheduleTokenRefresh = useCallback(
		(token: string) => {
			// Clear any existing timer
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}

			const timeUntilExpiry = getTokenExpirationTime(token);
			// Refresh 60 seconds before expiry, but at least 10 seconds from now
			const refreshIn = Math.max(timeUntilExpiry - 60000, 10000);

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

					// Import api here to avoid circular dependency at module level
					const { api } = await import("@/lib/api");
					const response = await api.post("/auth/refresh", {
						refresh_token: currentRefreshToken,
					});

					const { access_token, refresh_token: newRefreshToken } =
						response.data;

					// Update tokens in storage and state
					setAccessToken(access_token);
					setRefreshToken(newRefreshToken);

					console.log("Token refreshed successfully");

					// Schedule next refresh
					scheduleTokenRefresh(access_token);
				} catch (error) {
					console.error("Proactive token refresh failed:", error);
					// Don't clear auth here - the interceptor will handle it on next request
				}
			}, refreshIn);
		},
		[setAccessToken, setRefreshToken],
	);

	/**
	 * Clear the refresh timer
	 */
	const clearRefreshTimer = useCallback(() => {
		if (refreshTimerRef.current) {
			clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = null;
		}
	}, []);

	/**
	 * Sign in with email and password
	 */
	const signIn = async (email: string, password: string): Promise<void> => {
		const response = await authApi.login({ email, password });

		// Store tokens
		setAccessToken(response.access_token);
		setRefreshToken(response.refresh_token);

		// Fetch and store user email
		try {
			const user = await authApi.getMe();
			setUserEmail(user.email);
		} catch (error) {
			console.error("Failed to fetch user profile:", error);
			// Still allow login even if profile fetch fails
		}

		// Schedule proactive refresh
		scheduleTokenRefresh(response.access_token);
	};

	/**
	 * Sign up with registration data
	 */
	const signUp = async (data: RegisterRequest): Promise<void> => {
		const user = await authApi.register(data);
		await signIn(user.email, data.password);
	};

	/**
	 * Sign out - call backend logout then clear local storage
	 */
	const signOut = async (): Promise<void> => {
		// Clear refresh timer
		clearRefreshTimer();

		try {
			// Call backend logout to revoke refresh token
			const currentRefreshToken = await getStorageItemAsync(
				STORAGE_KEYS.REFRESH_TOKEN,
			);
			if (currentRefreshToken) {
				await authApi.logout(currentRefreshToken);
			}
		} catch (error) {
			console.error("Backend logout failed:", error);
			// Continue with local logout even if backend fails
		}

		// Clear local storage
		await clearAuthStorage();

		// Update state
		setAccessToken(null);
		setRefreshToken(null);
		setUserEmail(null);
	};

	// Set up auth failure callback for API interceptor
	useEffect(() => {
		setAuthFailureCallback(() => {
			clearRefreshTimer();
			setAccessToken(null);
			setRefreshToken(null);
			setUserEmail(null);
		});

		return () => {
			setAuthFailureCallback(() => {});
		};
	}, [clearRefreshTimer, setAccessToken, setRefreshToken, setUserEmail]);

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

	return (
		<AuthContext.Provider
			value={{
				session: accessToken,
				userEmail,
				isLoading,
				signIn,
				signUp,
				signOut,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
