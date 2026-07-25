import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Spinner } from "heroui-native/spinner";
import {
	BellIcon,
	FlowerIcon,
	MessagesSquareIcon,
	SparklesIcon,
	UserIcon,
	WindIcon,
} from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { useAuth } from "@/context/AuthContext";
import { getFirstName, getTodaysDate } from "@/utils/ui-format";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledWindIcon = withUniwind(WindIcon);
const StyledBellIcon = withUniwind(BellIcon);
const StyledSparklesIcon = withUniwind(SparklesIcon);
const StyledFlowerIcon = withUniwind(FlowerIcon);
const StyledMessagesSquareIcon = withUniwind(MessagesSquareIcon);

export default function Index() {
	// Mock auth setup
	// const { user, signOut } = useAuth();
	const user = { full_name: "Yagnik Patel" };
	const signOut = async () => {};
	const router = useRouter();

	function newCompanionVoiceChat() {
		const chatId = randomUUID();
		router.navigate(`/companion/${chatId}?new=true`);
	}

	function breathingExercise() {
		router.navigate("/breathing");
	}

	if (!user)
		return (
			<View className="flex-1 bg-background justify-center items-center">
				<Spinner size="lg" />
			</View>
		);

	const date = getTodaysDate();
	const firstName = getFirstName(user.full_name);

	return (
		<StyledSafeAreaView className="flex-1 bg-background">
			<View className="px-6 mt-2 flex-row items-center justify-between">
				<View className="flex-row items-center gap-x-2">
					<UserIcon size={32} strokeWidth={1.5} />
					<View>
						<Text className="text-lg font-sans-medium text-foreground">
							Good Morning, {firstName}
						</Text>
						<Text className="text-sm text-muted">{date}</Text>
					</View>
				</View>
				<Button
					onPress={async () => await signOut()}
					variant="ghost"
					isIconOnly
				>
					<StyledBellIcon className="size-20" />
				</Button>
			</View>
			<View className="flex-1 py-4 px-6">
				<View className="bg-[#F9E3D0] py-6 px-8 gap-2 rounded-3xl">
					<View className="flex-row gap-2 items-center">
						<StyledSparklesIcon className="text-muted" size={16} />
						<Text
							style={{ includeFontPadding: false }}
							className="font-sans-medium uppercase text-muted text-xs"
						>
							Daily Zen
						</Text>
					</View>
					<Text className="text-xl font-sans text-foreground">
						“
						<Text className="text-lg font-sans-italic text-foreground">
							{"Every breath is a fresh beginning, a quiet space to simply be."}
						</Text>
						”
					</Text>
				</View>
				<View className="flex-row gap-4 mt-4">
					<PressableFeedback
						onPress={newCompanionVoiceChat}
						className="px-4 py-8 flex-1 basis-1/2 items-center bg-accent/5 border border-accent/20 rounded-3xl"
					>
						<View className="bg-accent/50 p-4 rounded-full items-center justify-center">
							<StyledFlowerIcon className="text-accent-foreground" />
						</View>
						<Text className="text-lg font-sans-medium text-foreground mt-2">
							Companion
						</Text>
						<Text className="font-sans text-xs text-muted text-center">
							Deep reflection & therepeutic support
						</Text>
					</PressableFeedback>
					<PressableFeedback className="px-4 py-8 flex-1 basis-1/2 items-center bg-danger/5 border border-danger/20 rounded-3xl">
						<View className="bg-danger/50 p-4 rounded-full items-center justify-center">
							<StyledMessagesSquareIcon className="text-accent-foreground" />
						</View>
						<Text className="text-lg font-sans-medium text-foreground mt-2">
							Friend
						</Text>
						<Text className="font-sans text-xs text-muted text-center">
							Casual chats & daily venting
						</Text>
					</PressableFeedback>
				</View>
				<Button
					onPress={breathingExercise}
					className="h-16 mt-4 bg-surface"
					variant="outline"
					size="lg"
				>
					<StyledWindIcon size={20} className="text-foreground" />
					<Button.Label className="font-sans text-foreground">
						Start Breathing
					</Button.Label>
				</Button>
			</View>
		</StyledSafeAreaView>
	);
}
