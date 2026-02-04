import "../global.css";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native/provider";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Uniwind } from "uniwind";
import { AuthProvider, useSession } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();
Uniwind.setTheme("light");

function RootLayoutNav() {
	const { session, isLoading } = useSession();
	const [loaded, error] = useFonts({
		"Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
		"Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
		"Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
		"Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
		"Rubik-Bold": require("../assets/fonts/Rubik-Bold.ttf"),
		"Rubik-Black": require("../assets/fonts/Rubik-Black.ttf"),
		DMSerifDisplay: require("../assets/fonts/DMSerifDisplay.ttf"),
	});

	useEffect(() => {
		if (loaded || error) {
			SplashScreen.hideAsync();
		}
	}, [loaded, error]);

	if (!loaded && !error) {
		return null;
	}

	if (isLoading) {
		return (
			<View className="flex-1 justify-center items-center">
				<ActivityIndicator size="large" />
			</View>
		);
	}

	const isAuthenticated = !!session;

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Protected guard={isAuthenticated}>
				<Stack.Screen name="(app)" />
			</Stack.Protected>
			<Stack.Protected guard={!isAuthenticated}>
				<Stack.Screen name="(auth)" />
			</Stack.Protected>
		</Stack>
	);
}

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<KeyboardProvider>
				<HeroUINativeProvider>
					<AuthProvider>
						<RootLayoutNav />
					</AuthProvider>
				</HeroUINativeProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
