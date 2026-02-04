import { AxiosError } from "axios";
import { Link, router } from "expo-router";
import { Button } from "heroui-native/button";
import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

export default function SignupScreen() {
	const { signUp } = useAuth();
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSignUp = async () => {
		if (!fullName.trim()) {
			setError("Full name is required");
			return;
		}
		if (!email.trim()) {
			setError("Email is required");
			return;
		}
		if (!password.trim()) {
			setError("Password is required");
			return;
		}
		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}
		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			return;
		}

		setError("");
		setIsLoading(true);

		try {
			await signUp({
				full_name: fullName.trim(),
				email: email.trim().toLowerCase(),
				password: password,
			});

			Alert.alert(
				"Account Created",
				"Your account has been created successfully. Please sign in.",
				[
					{
						text: "OK",
						onPress: () => router.replace("/signin"),
					},
				],
			);
		} catch (error) {
			console.error("Sign up error:", error);
			let message = "An unexpected error occurred";

			if (error instanceof AxiosError) {
				if (error.response?.data?.detail) {
					message =
						typeof error.response.data.detail === "string"
							? error.response.data.detail
							: "Registration failed. Please check your information.";
				} else if (error.message) {
					message = error.message;
				}
			}

			setError(message);
		} finally {
			setIsLoading(false);
		}
	};

	const renderInput = (
		label: string,
		value: string,
		onChangeText: (text: string) => void,
		options?: {
			secureTextEntry?: boolean;
			keyboardType?: "default" | "email-address";
			autoCapitalize?: "none" | "words";
		},
	) => (
		<TextField>
			{/*<Label>{label}</Label>*/}
			<Input
				// className="px-4"
				value={value}
				onChangeText={onChangeText}
				autoCapitalize={options?.autoCapitalize ?? "none"}
				autoCorrect={false}
				editable={!isLoading}
				placeholder={label}
				secureTextEntry={options?.secureTextEntry}
				keyboardType={options?.keyboardType ?? "default"}
				variant="secondary"
			/>
		</TextField>
	);

	return (
		<KeyboardAvoidingView className="flex-1" behavior="padding">
			<SafeAreaView style={{ flex: 1 }}>
				<ScrollView
					contentContainerStyle={{
						flexGrow: 1,
						justifyContent: "center",
					}}
					keyboardShouldPersistTaps="handled"
					style={{
						flex: 1,
						backgroundColor: "#F8FAFC",
					}}
				>
					<View className="flex-1 px-6 py-6">
						<Text className="text-base font-sans text-neutral-600 uppercase">
							Create Account
						</Text>

						<Text className="text-4xl font-serif text-neutral-700 mt-12">
							Your journey starts here.
						</Text>
						<Text className="font-sans text-base text-neutral-700 font-semibold mt-4">
							Join a safe space built for your mental well-being and growth.
						</Text>

						<View className="gap-2 mt-8">
							{renderInput("Full Name", fullName, setFullName, {
								autoCapitalize: "words",
							})}

							{renderInput("Email", email, setEmail, {
								keyboardType: "email-address",
							})}

							{renderInput("Password", password, setPassword, {
								secureTextEntry: true,
							})}

							{renderInput(
								"Confirm Password",
								confirmPassword,
								setConfirmPassword,
								{ secureTextEntry: true },
							)}

							{error ? (
								<View
									className="bg-red-50 border-red-200 rounded-xl p-4 border"
									style={{
										borderCurve: "continuous",
									}}
								>
									<Text
										className="text-danger font-sans-medium text-sm text-center"
										selectable
									>
										{error}
									</Text>
								</View>
							) : null}

							<Button
								onPress={handleSignUp}
								isDisabled={isLoading}
								size="lg"
								className="rounded-full h-16 mt-4"
							>
								{isLoading ? (
									<ActivityIndicator color={"#ddd"} size={24} />
								) : (
									<Text className="font-sans-semibold text-lg text-accent-foreground">
										Start My Journey
									</Text>
								)}
							</Button>

							<Text className="text-sm text-muted text-center mt-4 font-sans">
								By signing up, you agree to our{" "}
								<Text className="text-accent font-sans-medium">
									Terms of Service
								</Text>{" "}
								and{" "}
								<Text className="text-accent font-sans-medium">
									Privacy Policy
								</Text>
							</Text>
						</View>

						<View className="flex-row justify-center mt-4 gap-1">
							<Text className="text-base font-sans text-neutral-700">
								Already have an account?{" "}
								<Link className="underline" href="/signin">
									Sign In
								</Link>
							</Text>
						</View>
					</View>
				</ScrollView>
			</SafeAreaView>
		</KeyboardAvoidingView>
	);
}
