import axios, {
	type AxiosError,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";

import { getStorageItemAsync, STORAGE_KEYS } from "./auth";

// API Base URL Configuration
function getApiBaseUrl(): string {
	const configuredHost = process.env.EXPO_PUBLIC_API_HOST_URL;
	if (configuredHost) {
		const protocol = configuredHost.startsWith("http") ? "" : "https://";
		return `${protocol}${configuredHost}`.replace(/\/$/, "");
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

function getWebsocketBaseUrl(): string {
	return API_BASE_URL.replace(/^http/, "ws");
}

export const API_BASE_URL = getApiBaseUrl();
export const WEBSOCKET_BASE_URL = getWebsocketBaseUrl();

/** Builds the authenticated URL required by the streaming chat endpoint. */
export function createChatWebSocketUrl(idToken: string): string {
	const url = new URL("/chat", `${WEBSOCKET_BASE_URL}/`);
	url.searchParams.set("token", idToken);
	return url.toString();
}

// Auth failure callback — called when a 401 can't be recovered.
// AuthContext registers a handler here that force-refreshes the Firebase
// token and updates SecureStore, so a retry can use the new token.
let onAuthFailure: (() => void | Promise<void>) | null = null;

export function setAuthFailureCallback(callback: () => void | Promise<void>) {
	onAuthFailure = callback;
}

// Guard against concurrent 401 retries across parallel requests.
let isRefreshingToken = false;

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

	// Response interceptor — on 401, ask AuthContext to force-refresh the
	// Firebase token, then retry the original request once with the new token.
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
					// AuthContext's callback force-refreshes the Firebase token
					// and writes the new value to SecureStore.
					await onAuthFailure?.();

					const freshToken = await getStorageItemAsync(STORAGE_KEYS.ID_TOKEN);
					if (freshToken) {
						originalRequest.headers.Authorization = `Bearer ${freshToken}`;
						return api(originalRequest);
					}
				} finally {
					isRefreshingToken = false;
				}
			}

			return Promise.reject(error);
		},
	);

	return api;
}

// Export the configured API client
export const api = createApiClient();
