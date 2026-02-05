import axios, {
	type AxiosError,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";

import {
	clearAuthStorage,
	getStorageItemAsync,
	STORAGE_KEYS,
	setStorageItemAsync,
} from "./auth";
import { PUBLIC_ENDPOINTS, TOKEN_REFRESH_BUFFER_SECONDS } from "./constants";
import { isTokenExpired } from "./jwt";
import type {
	LoginRequest,
	LogoutResponse,
	RegisterRequest,
	TokenResponse,
	UserResponse,
} from "./types/auth";

// Re-export types for convenience
export type {
	LoginRequest,
	LogoutRequest,
	LogoutResponse,
	RegisterRequest,
	TokenResponse,
	UserResponse,
} from "./types/auth";

// API Base URL Configuration
function getApiBaseUrl(): string {
	if (process.env.EXPO_PUBLIC_API_URL) {
		return process.env.EXPO_PUBLIC_API_URL;
	}

	const expoUrl = Constants.expoConfig?.hostUri || Constants.experienceUrl;
	if (expoUrl) {
		const cleanUrl = expoUrl.replace("exp://", "");
		const host = cleanUrl.split(":")[0];
		if (host && host !== "localhost" && host !== "127.0.0.1") {
			return `http://${host}:8000`;
		}
	}

	return "http://localhost:8000";
}

export const API_BASE_URL = getApiBaseUrl();

// Token refresh queue management
interface QueueItem {
	resolve: (value: string | null) => void;
	reject: (error: Error) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
	failedQueue.forEach((item) => {
		if (error) {
			item.reject(error);
		} else {
			item.resolve(token);
		}
	});
	failedQueue = [];
};

// Auth failure callback
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureCallback(callback: () => void) {
	onAuthFailure = callback;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
	try {
		const refreshToken = await getStorageItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
		if (!refreshToken) {
			return null;
		}

		// Use a fresh axios instance to avoid interceptor loops
		const response = await axios.post<TokenResponse>(
			`${API_BASE_URL}/auth/refresh`,
			{
				refresh_token: refreshToken,
			},
		);

		const { access_token, refresh_token: newRefreshToken } = response.data;

		// Store the new tokens (refresh token rotation)
		await Promise.all([
			setStorageItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access_token),
			setStorageItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken),
		]);

		return access_token;
	} catch (error) {
		console.error("Failed to refresh token:", error);
		return null;
	}
}

/**
 * Handle token refresh with queue management
 */
async function handleTokenRefresh(): Promise<string | null> {
	if (!isRefreshing) {
		isRefreshing = true;
		try {
			const token = await refreshAccessToken();
			processQueue(null, token);
			return token;
		} catch (error) {
			processQueue(error as Error, null);
			throw error;
		} finally {
			isRefreshing = false;
		}
	}

	// Wait for ongoing refresh
	return new Promise<string | null>((resolve, reject) => {
		failedQueue.push({ resolve, reject });
	});
}

/**
 * Check if URL is a public endpoint
 */
function isPublicEndpoint(url: string | undefined): boolean {
	if (!url) return false;
	return PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

/**
 * Create the axios instance with interceptors
 */
function createApiClient(): AxiosInstance {
	const api = axios.create({
		baseURL: API_BASE_URL,
		headers: {
			"Content-Type": "application/json",
		},
	});

	// Request interceptor - attach access token and proactively refresh if needed
	api.interceptors.request.use(
		async (config: InternalAxiosRequestConfig) => {
			if (isPublicEndpoint(config.url)) {
				return config;
			}

			let accessToken = await getStorageItemAsync(STORAGE_KEYS.ACCESS_TOKEN);

			// Proactively refresh if token is about to expire
			if (
				accessToken &&
				isTokenExpired(accessToken, TOKEN_REFRESH_BUFFER_SECONDS)
			) {
				console.log("Token about to expire, refreshing proactively...");
				accessToken = await handleTokenRefresh();
			}

			if (accessToken) {
				config.headers.Authorization = `Bearer ${accessToken}`;
			}

			return config;
		},
		(error) => Promise.reject(error),
	);

	// Response interceptor - handle 401 errors
	api.interceptors.response.use(
		(response) => response,
		async (error: AxiosError) => {
			const originalRequest = error.config as InternalAxiosRequestConfig & {
				_retry?: boolean;
			};

			// If we get a 401 and haven't retried yet
			if (error.response?.status === 401 && !originalRequest._retry) {
				// Skip retry for auth endpoints
				if (originalRequest.url?.includes("/auth/")) {
					return Promise.reject(error);
				}

				originalRequest._retry = true;

				try {
					const newToken = await handleTokenRefresh();

					if (newToken) {
						originalRequest.headers.Authorization = `Bearer ${newToken}`;
						return api(originalRequest);
					}
				} catch {
					// Token refresh failed
				}

				// Refresh failed - clear auth and notify
				await clearAuthStorage();
				onAuthFailure?.();
			}

			return Promise.reject(error);
		},
	);

	return api;
}

// Export the configured API client
export const api = createApiClient();

// Auth API functions
export const authApi = {
	health: async (): Promise<{ status: string }> => {
		const response = await api.get<{ status: string }>("/health");
		return response.data;
	},

	login: async (data: LoginRequest): Promise<TokenResponse> => {
		const response = await api.post<TokenResponse>("/auth/login", data);
		return response.data;
	},

	register: async (data: RegisterRequest): Promise<UserResponse> => {
		const response = await api.post<UserResponse>("/auth/register", data);
		return response.data;
	},

	logout: async (refreshToken: string): Promise<LogoutResponse> => {
		const response = await api.post<LogoutResponse>("/auth/logout", {
			refresh_token: refreshToken,
		});
		return response.data;
	},

	getMe: async (): Promise<UserResponse> => {
		const response = await api.get<UserResponse>("/users/me");
		return response.data;
	},
};
