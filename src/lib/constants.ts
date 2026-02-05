// Storage keys for auth tokens and user data
export const STORAGE_KEYS = {
	ACCESS_TOKEN: "accessToken",
	REFRESH_TOKEN: "refreshToken",
	USER_DATA: "userData",
} as const;

// Public endpoints that don't require authentication
export const PUBLIC_ENDPOINTS = [
	"/auth/login",
	"/auth/register",
	"/auth/refresh",
	"/health",
] as const;

// Token refresh buffer time in seconds
export const TOKEN_REFRESH_BUFFER_SECONDS = 60;

// Minimum time before scheduling a token refresh (milliseconds)
export const MIN_REFRESH_DELAY_MS = 10000;
