import axios, {
	type AxiosError,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import {
	GoogleOneTapSignIn,
	isSuccessResponse,
} from "react-native-nitro-google-signin";

import {
	clearAuthStorage,
	getStorageItemAsync,
	STORAGE_KEYS,
	setStorageItemAsync,
} from "./auth";

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

// Auth failure callback — called when a 401 can't be recovered
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureCallback(callback: () => void) {
	onAuthFailure = callback;
}

// Track if a silent refresh is in progress to avoid concurrent retries
let isRefreshingToken = false;

/**
 * Attempt a silent Google sign-in to get a fresh idToken.
 * Returns the new token on success, null otherwise.
 */
async function silentlyRefreshIdToken(): Promise<string | null> {
	try {
		const response = await GoogleOneTapSignIn.signIn();
		if (isSuccessResponse(response) && response.data?.idToken) {
			await setStorageItemAsync(STORAGE_KEYS.ID_TOKEN, response.data.idToken);
			return response.data.idToken;
		}
		return null;
	} catch {
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

	// Request interceptor — attach idToken as Bearer
	api.interceptors.request.use(
		async (config: InternalAxiosRequestConfig) => {
			const idToken = await getStorageItemAsync(STORAGE_KEYS.ID_TOKEN);
			if (idToken) {
				config.headers.Authorization = `Bearer ${idToken}`;
			}
			return config;
		},
		(error) => Promise.reject(error),
	);

	// Response interceptor — on 401, attempt one silent token refresh then retry
	api.interceptors.response.use(
		(response) => response,
		async (error: AxiosError) => {
			const originalRequest = error.config as InternalAxiosRequestConfig & {
				_retry?: boolean;
			};

			if (
				error.response?.status === 401 &&
				!originalRequest._retry &&
				!isRefreshingToken
			) {
				originalRequest._retry = true;
				isRefreshingToken = true;

				try {
					const newToken = await silentlyRefreshIdToken();
					if (newToken) {
						originalRequest.headers.Authorization = `Bearer ${newToken}`;
						return api(originalRequest);
					}
				} finally {
					isRefreshingToken = false;
				}

				// Refresh failed — clear auth and notify the context
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
