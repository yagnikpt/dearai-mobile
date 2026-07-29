import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initExecutorch } from "react-native-executorch";
import { ExpoResourceFetcher } from "react-native-executorch-expo-resource-fetcher";

initExecutorch({
	resourceFetcher: ExpoResourceFetcher,
});

export default function RootLayout() {
	return (
		<>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="chat/new" />
				<Stack.Screen name="chat/[id]" />
				<Stack.Screen name="diary/[id]" />
				<Stack.Screen name="voice/new" />
				<Stack.Screen name="voice/[id]" />
				{/*<Stack.Screen name="test_cam" />*/}
			</Stack>
			<StatusBar style="dark" />
		</>
	);
}
