import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
	const { signOut, userEmail } = useAuth();

	const handleSignOut = () => {
		Alert.alert("Sign Out", "Are you sure you want to sign out?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Sign Out",
				style: "destructive",
				onPress: async () => {
					try {
						await signOut();
					} catch (error) {
						console.error("Sign out error:", error);
						Alert.alert("Error", "Failed to sign out. Please try again.");
					}
				},
			},
		]);
	};

	return (
		<View className="flex-1 bg-white items-center justify-center p-6">
			<Text className="text-2xl font-bold text-gray-800 mb-2">Welcome!</Text>
			{userEmail && (
				<Text className="text-gray-600 mb-8">Logged in as: {userEmail}</Text>
			)}
			<TouchableOpacity
				className="bg-red-500 px-6 py-3 rounded-lg"
				onPress={handleSignOut}
			>
				<Text className="text-white font-semibold">Sign Out</Text>
			</TouchableOpacity>
		</View>
	);
}
