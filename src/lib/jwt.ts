export interface JWTPayload {
	exp?: number;
	sub?: string;
	[key: string]: unknown;
}

/**
 * Decode JWT token payload without verification
 * Used for reading expiration time
 */
export function decodeJWT(token: string): JWTPayload | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;

		const payload = parts[1];
		// Base64 URL decode
		const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split("")
				.map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
				.join(""),
		);

		return JSON.parse(jsonPayload);
	} catch (e) {
		console.error("Failed to decode JWT:", e);
		return null;
	}
}

/**
 * Check if a JWT token is expired or about to expire
 * @param token JWT token string
 * @param bufferSeconds Seconds before actual expiration to consider it expired (default 60s)
 */
export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
	const decoded = decodeJWT(token);
	if (!decoded || !decoded.exp) return true;

	const expirationTime = decoded.exp * 1000; // Convert to milliseconds
	const currentTime = Date.now();
	const bufferTime = bufferSeconds * 1000;

	return currentTime >= expirationTime - bufferTime;
}

/**
 * Get time until token expires in milliseconds
 * Returns 0 if token is already expired or invalid
 */
export function getTokenExpirationTime(token: string): number {
	const decoded = decodeJWT(token);
	if (!decoded || !decoded.exp) return 0;

	const expirationTime = decoded.exp * 1000;
	const currentTime = Date.now();
	const timeUntilExpiration = expirationTime - currentTime;

	return timeUntilExpiration > 0 ? timeUntilExpiration : 0;
}
