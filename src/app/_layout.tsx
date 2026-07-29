import "../global.css";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native/provider";
import { Spinner } from "heroui-native/spinner";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GoogleOneTapSignIn } from "react-native-nitro-google-signin";
import { Uniwind } from "uniwind";
import { AmbientMusicProvider } from "@/context/AmbientMusicContext";
import { AuthProvider, useSession } from "@/context/AuthContext";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";

SplashScreen.preventAutoHideAsync();
Uniwind.setTheme("light");

GoogleOneTapSignIn.configure({
	webClientId: "autoDetect",
});

function RootLayoutNav() {
	const { session, isLoading } = useSession();
	const { isLoading: areSettingsLoading } = useSettings();
	const [loaded, error] = useFonts({
		"Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
		"Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
		"Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
		"Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
		"Rubik-Bold": require("../assets/fonts/Rubik-Bold.ttf"),
		"Rubik-Black": require("../assets/fonts/Rubik-Black.ttf"),
		"Rubik-Italic-Regular": require("../assets/fonts/Rubik-Italic.ttf"),
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

	if (isLoading || areSettingsLoading) {
		return (
			<View className="flex-1 bg-background justify-center items-center">
				<Spinner size="lg" />
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
				<HeroUINativeProvider
					config={{ devInfo: { stylingPrinciples: false } }}
				>
					<AuthProvider>
						<SettingsProvider>
							{/*<AmbientMusicProvider>*/}
							<RootLayoutNav />
							{/*</AmbientMusicProvider>*/}
						</SettingsProvider>
					</AuthProvider>
				</HeroUINativeProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}
