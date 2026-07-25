import { Image } from "expo-image";
import { Button } from "heroui-native/button";
import { Spinner } from "heroui-native/spinner";
import { useState } from "react";
import { Text, View } from "react-native";
import { isErrorWithCode, statusCodes } from "react-native-nitro-google-signin";
import { LinearTransition } from "react-native-reanimated";
import { useAuth } from "@/context/AuthContext";

export default function SignInScreen() {
	const { signIn } = useAuth();
	const [isLoading, setIsLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const handleSignIn = async () => {
		setIsLoading(true);
		setErrorMsg(null);

		try {
			await signIn();
		} catch (error) {
			if (isErrorWithCode(error)) {
				switch (error.code) {
					case statusCodes.SIGN_IN_CANCELLED:
						// User dismissed — not an error
						break;
					case statusCodes.IN_PROGRESS:
						setErrorMsg("Sign-in already in progress.");
						break;
					case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
						setErrorMsg("Google Play Services is not available.");
						break;
					default:
						setErrorMsg("Something went wrong. Please try again.");
						console.error("Google Sign-In error:", error);
				}
			} else {
				setErrorMsg("Something went wrong. Please try again.");
				console.error("Sign-in error:", error);
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<View className="flex-1 bg-background">
			<Image
				contentFit="cover"
				source={require("@/assets/images/onboarding.jpeg")}
				contentPosition={{ top: "20%" }}
				style={{
					width: "100%",
					height: "50%",
					borderBottomLeftRadius: 32,
					borderBottomRightRadius: 32,
				}}
			/>

			<View className="flex-1 px-10 items-center gap-6 py-20">
				<View className="items-center gap-2">
					<Text className="text-4xl text-center font-serif text-neutral-700">
						Welcome
					</Text>
					<Text className="font-sans text-base text-muted font-semibold text-center">
						Take a deep breath and step inside.
					</Text>
				</View>

				{errorMsg ? (
					<Text className="text-sm text-danger text-center font-sans">
						{errorMsg}
					</Text>
				) : null}

				<Button
					isIconOnly={isLoading}
					layout={LinearTransition.springify()}
					isDisabled={isLoading}
					variant="secondary"
					className="self-center"
					onPress={handleSignIn}
				>
					{isLoading ? (
						<Spinner />
					) : (
						<>
							<Image
								source={require("@/assets/icons/google.svg")}
								style={{
									width: 24,
									height: 24,
								}}
							/>
							<Button.Label className="text-accent-soft-foreground font-sans-medium">
								Sign in with Google
							</Button.Label>
						</>
					)}
				</Button>
			</View>
		</View>
	);
}
