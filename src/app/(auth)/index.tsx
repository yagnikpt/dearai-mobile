import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
// import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { Text, View } from "react-native";

export default function App() {
	const router = useRouter();

	return (
		<View className="flex-1 bg-background">
			<Image
				contentFit="cover"
				source={require("../../assets/images/onboarding_1.jpeg")}
				contentPosition={"bottom center"}
				style={{
					width: "100%",
					height: "50%",
					borderBottomLeftRadius: 32,
					borderBottomRightRadius: 32,
				}}
			/>
			<View className="flex-1 p-10 justify-center">
				<Text className="text-4xl text-center font-serif text-neutral-700">
					Your Safe Space for Reflection
				</Text>
				<Text className="font-sans text-lg text-neutral-700 font-semibold text-center mt-8">
					Meet DearAI, your non-judgmental AI companion here to listen, support,
					and help you find your daily calm.
				</Text>
				<Button
					onPress={() => router.navigate("/(auth)/signup")}
					className="mt-8"
					size="lg"
				>
					<Text className="font-sans-semibold text-lg text-accent-foreground">
						Get Started
					</Text>
				</Button>
				<Link
					className="text-center text-base font-sans text-neutral-700 mt-4 underline"
					href="/(auth)/signin"
				>
					Sign in instead
				</Link>
			</View>
			{/*<StatusBar style="light" />*/}
		</View>
	);
}
