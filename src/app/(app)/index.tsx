import { Button } from "heroui-native/button";
import { PressableFeedback } from "heroui-native/pressable-feedback";
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

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledWindIcon = withUniwind(WindIcon);
const StyledBellIcon = withUniwind(BellIcon);
const StyledSparklesIcon = withUniwind(SparklesIcon);
const StyledFlowerIcon = withUniwind(FlowerIcon);
const StyledMessagesSquareIcon = withUniwind(MessagesSquareIcon);

export default function Index() {
	const { user } = useAuth();

	return (
		<StyledSafeAreaView className="flex-1 bg-background">
			<View className="px-6 mt-2 flex-row items-center justify-between">
				<View className="flex-row items-center gap-x-2">
					<UserIcon size={32} />
					<View>
						<Text className="text-lg font-sans-medium text-foreground">
							Good Morning, {user?.full_name.split(" ")[0]}
						</Text>
						<Text className="text-sm text-muted">Mon, Oct 24</Text>
					</View>
				</View>
				<Button variant="ghost" isIconOnly>
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
					<PressableFeedback className="p-8 flex-1 basis-1/2 items-center bg-accent/10 border border-accent/20 rounded-3xl">
						<PressableFeedback.Ripple />
						<View className="bg-accent/50 p-4 rounded-full items-center justify-center">
							<StyledFlowerIcon className="text-white" />
						</View>
						<Text className="text-lg font-sans-medium text-foreground mt-2">
							Companion
						</Text>
						<Text className="font-sans text-xs text-muted text-center">
							Deep reflection & therepeutic support
						</Text>
					</PressableFeedback>
					<PressableFeedback className="p-8 flex-1 basis-1/2 items-center bg-danger/5 border border-danger/20 rounded-3xl">
						<PressableFeedback.Ripple />
						<View className="bg-danger/50 p-4 rounded-full items-center justify-center">
							<StyledMessagesSquareIcon className="text-white" />
						</View>
						<Text className="text-lg font-sans-medium text-foreground mt-2">
							Friend
						</Text>
						<Text className="font-sans text-xs text-muted text-center">
							Casual chats & daily venting
						</Text>
					</PressableFeedback>
				</View>
				<Button className="h-16 mt-4 bg-white" variant="outline" size="lg">
					<StyledWindIcon size={20} className="text-foreground" />
					<Button.Label className="font-sans text-foreground">
						Start Breathing
					</Button.Label>
				</Button>
			</View>
		</StyledSafeAreaView>
	);
}
