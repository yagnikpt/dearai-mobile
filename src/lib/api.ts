import axios, {
	type AxiosError,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import {
	clearAuthStorage,
	getStorageItemAsync,
	isTokenExpired,
	STORAGE_KEYS,
	setStorageItemAsync,
} from "./auth";

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

const API_BASE_URL = getApiBaseUrl();

// Token refresh state to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let failedQueue: {
	resolve: (value: string | null) => void;
	reject: (error: Error) => void;
}[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
	failedQueue.forEach((prom) => {
		if (error) {
			prom.reject(error);
		} else {
			prom.resolve(token);
		}
	});
	failedQueue = [];
};

// Callback for when auth fails completely (will be set by AuthContext)
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureCallback(callback: () => void) {
	onAuthFailure = callback;
}

/**
 * Refresh the access token using the refresh token
 * Returns the new access token or null if refresh failed
 */
async function refreshAccessToken(): Promise<string | null> {
	try {
		const refreshToken = await getStorageItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
		if (!refreshToken) {
			return null;
		}

		// Use a fresh axios instance to avoid interceptor loops
		const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
			refresh_token: refreshToken,
		});

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
			const publicEndpoints = [
				"/auth/login",
				"/auth/register",
				"/auth/refresh",
				"/health",
			];
			if (publicEndpoints.some((endpoint) => config.url?.includes(endpoint))) {
				return config;
			}

			let accessToken = await getStorageItemAsync(STORAGE_KEYS.ACCESS_TOKEN);

			// Proactively refresh if token is about to expire (within 60 seconds)
			if (accessToken && isTokenExpired(accessToken, 60)) {
				console.log("Token about to expire, refreshing proactively...");

				if (!isRefreshing) {
					isRefreshing = true;

					try {
						accessToken = await refreshAccessToken();
						processQueue(null, accessToken);
					} catch (error) {
						processQueue(error as Error, null);
					} finally {
						isRefreshing = false;
					}
				} else {
					// Wait for the ongoing refresh to complete
					accessToken = await new Promise<string | null>((resolve, reject) => {
						failedQueue.push({ resolve, reject });
					});
				}
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

				if (!isRefreshing) {
					isRefreshing = true;

					try {
						const newToken = await refreshAccessToken();

						if (newToken) {
							processQueue(null, newToken);
							originalRequest.headers.Authorization = `Bearer ${newToken}`;
							return api(originalRequest);
						} else {
							// Refresh failed - clear auth and notify
							processQueue(new Error("Token refresh failed"), null);
							await clearAuthStorage();
							onAuthFailure?.();
							return Promise.reject(error);
						}
					} catch (refreshError) {
						processQueue(refreshError as Error, null);
						await clearAuthStorage();
						onAuthFailure?.();
						return Promise.reject(refreshError);
					} finally {
						isRefreshing = false;
					}
				} else {
					// Wait for the ongoing refresh to complete
					try {
						const token = await new Promise<string | null>(
							(resolve, reject) => {
								failedQueue.push({ resolve, reject });
							},
						);

						if (token) {
							originalRequest.headers.Authorization = `Bearer ${token}`;
							return api(originalRequest);
						}
					} catch (queueError) {
						return Promise.reject(queueError);
					}
				}
			}

			return Promise.reject(error);
		},
	);

	return api;
}

// Export the configured API client
export const api = createApiClient();

// Export base URL for any direct usage
export { API_BASE_URL };

// API Types based on OpenAPI spec
export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	full_name: string;
	email: string;
	password: string;
}

export interface TokenResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
}

export interface UserResponse {
	id: string;
	full_name: string;
	email: string;
	gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
	age?: number | null;
	created_at: string;
}

export interface LogoutRequest {
	refresh_token: string;
}

export interface LogoutResponse {
	message: string;
}

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
