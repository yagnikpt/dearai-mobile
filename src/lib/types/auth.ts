// Google user profile stored locally after sign-in
export interface StoredUser {
	id: string;
	full_name: string;
	email: string;
	photo: string | null;
}

// Auth Context Types
export interface AuthContextType {
	/** The current Google idToken, or null when signed out */
	session: string | null;
	user: StoredUser | null;
	isLoading: boolean;
	signIn: () => Promise<void>;
	signOut: () => Promise<void>;
}
