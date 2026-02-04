import { AxiosError } from "axios";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Button } from "heroui-native/button";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useAuth } from "@/context/AuthContext";

export default function SignInScreen() {
	const { signIn } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const handleSignIn = async () => {
		if (!email.trim() || !password.trim()) {
			Alert.alert("Error", "Please enter email and password");
			return;
		}

		setIsLoading(true);
		try {
			await signIn(email.trim(), password);
			setErrorMsg(null);
		} catch (error) {
			let message = "An unexpected error occurred";

			if (error instanceof AxiosError) {
				if (error.response?.status === 401) {
					message = "Invalid email or password";
				} else if (error.response?.data?.detail) {
					message =
						typeof error.response.data.detail === "string"
							? error.response.data.detail
							: "Invalid credentials";
				} else if (error.message) {
					message = error.message;
				} else {
					console.error("Sign in error:", error);
				}
			}

			setErrorMsg(message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<KeyboardAvoidingView
			contentContainerStyle={{ flex: 1 }}
			className="flex-1"
			behavior="position"
		>
			{/*<SafeAreaView style={{ flex: 1 }}>*/}
			<Image
				contentFit="cover"
				source={require("../../assets/images/onboarding.jpeg")}
				contentPosition={{ top: "20%" }}
				style={{
					width: "100%",
					height: "40%",
					borderBottomLeftRadius: 32,
					borderBottomRightRadius: 32,
				}}
			/>
			<View className="flex-1 p-10 justify-center">
				<Text className="text-4xl text-center font-serif text-neutral-700">
					Welcome Back
				</Text>
				<Text className="font-sans text-lg text-muted font-semibold text-center mt-4">
					Take a deep breath and step inside.
				</Text>
				<View className="gap-2 mt-4">
					<Input
						value={email}
						onChangeText={setEmail}
						autoCorrect={false}
						editable={!isLoading}
						placeholder={"Email"}
						keyboardType={"email-address"}
						variant="secondary"
					/>
					<Input
						value={password}
						onChangeText={setPassword}
						autoCorrect={false}
						editable={!isLoading}
						placeholder={"Password"}
						secureTextEntry
						variant="secondary"
					/>
					<FieldError isInvalid={!!errorMsg}>{errorMsg}</FieldError>
				</View>
				<Button
					onPress={handleSignIn}
					isDisabled={isLoading}
					className="mt-8"
					size="lg"
				>
					{isLoading ? (
						<ActivityIndicator color={"#ddd"} size={24} />
					) : (
						<Text className="font-sans-semibold text-lg text-accent-foreground">
							Sign In
						</Text>
					)}
				</Button>
				<Text className="text-center text-base font-sans text-neutral-700 mt-4">
					Don&apos;t have an account?{" "}
					<Link className="underline" href="/(auth)/signup">
						Sign up
					</Link>
				</Text>
			</View>
			{/*</SafeAreaView>*/}
			{/*<StatusBar style="light" />*/}
		</KeyboardAvoidingView>
	);
}
