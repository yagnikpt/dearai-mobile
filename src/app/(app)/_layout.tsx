import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
	return (
		<>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="chat/new" />
				<Stack.Screen name="chat/[id]" />
				<Stack.Screen name="voice/[id]" />
			</Stack>
			<StatusBar style="dark" />
		</>
	);
}
