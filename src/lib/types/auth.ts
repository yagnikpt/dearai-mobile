// API Request Types
export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	full_name: string;
	email: string;
	password: string;
}

export interface LogoutRequest {
	refresh_token: string;
}

// API Response Types
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

export interface LogoutResponse {
	message: string;
}

// Stored user data (subset of UserResponse for local storage)
export interface StoredUser {
	id: string;
	full_name: string;
	email: string;
}

// Auth Context Types
export interface AuthContextType {
	session: string | null;
	user: StoredUser | null;
	isLoading: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (data: RegisterRequest) => Promise<void>;
	signOut: () => Promise<void>;
}
