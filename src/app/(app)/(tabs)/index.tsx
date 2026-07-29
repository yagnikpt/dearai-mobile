import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Button } from "heroui-native/button";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Spinner } from "heroui-native/spinner";
import { SparklesIcon } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable, withUniwind } from "uniwind";
import { useAuth } from "@/context/AuthContext";
import { getFirstName, getTodaysDate, greetMessage } from "@/utils/ui-format";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledSparklesIcon = withUniwind(SparklesIcon);

export default function Index() {
	const { user } = useAuth();
	const router = useRouter();

	const fgColor = useCSSVariable("--color-accent");

	if (!user)
		return (
			<View className="flex-1 bg-background justify-center items-center">
				<Spinner size="lg" />
			</View>
		);

	const date = getTodaysDate();
	const firstName = getFirstName(user.full_name);
	const greeting = greetMessage();

	return (
		<StyledSafeAreaView edges={["top"]} className="flex-1 bg-background">
			<View className="px-7 mt-4">
				<Text className="text-3xl font-sans-medium">{greeting},</Text>
				<Text className="text-3xl font-sans-medium text-accent">
					{firstName}
				</Text>
				<Text className="mt-2 text-muted font-sans">{date}</Text>
			</View>

			<View className="flex-1 py-4 px-6">
				<View className="bg-surface border border-border py-6 px-4 gap-2 rounded-3xl">
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
				<Text className="text-base pl-1 mt-4 font-sans text-foreground">
					How can I help you today?
				</Text>
				<View className="flex-row gap-4 mt-4">
					<PressableFeedback
						onPress={() =>
							router.push({
								pathname: "/chat/new",
								params: { initial: "I need to vent, " },
							})
						}
						className="gap-y-8 p-4 bg-surface/70 shadow-sm border border-border rounded-2xl flex-1"
					>
						<SymbolView
							tintColor={fgColor?.toString()}
							name={{ ios: "air.purifier", android: "air" }}
							size={28}
						/>
						<Text className="font-sans text-lg">I need to vent</Text>
					</PressableFeedback>
					<PressableFeedback
						onPress={() =>
							router.push({
								pathname: "/chat/new",
								params: { initial: "Help me relax, " },
							})
						}
						className="gap-y-8 p-4 bg-surface/70 shadow-sm border border-border rounded-2xl flex-1"
					>
						<SymbolView
							tintColor={fgColor?.toString()}
							name={{ ios: "air.purifier", android: "self_improvement" }}
							size={28}
						/>
						<Text className="font-sans text-lg">Help me relax</Text>
					</PressableFeedback>
				</View>
				<View className="flex-row gap-4 mt-4">
					<PressableFeedback
						onPress={() =>
							router.push({
								pathname: "/chat/new",
								params: { initial: "I can't sleep, " },
							})
						}
						className="gap-y-8 p-4 bg-surface/70 shadow-sm border border-border rounded-2xl flex-1"
					>
						<SymbolView
							tintColor={fgColor?.toString()}
							name={{ ios: "air.purifier", android: "bedtime" }}
							size={28}
						/>
						<Text className="font-sans text-lg">I can&apos;t sleep</Text>
					</PressableFeedback>
					<PressableFeedback
						onPress={() =>
							router.push({
								pathname: "/chat/new",
								params: { initial: "Just feeling off, " },
							})
						}
						className="gap-y-8 p-4 bg-surface/70 shadow-sm border border-border rounded-2xl flex-1"
					>
						<SymbolView
							tintColor={fgColor?.toString()}
							name={{ ios: "air.purifier", android: "mindfulness" }}
							size={28}
						/>
						<Text className="font-sans text-lg">Just feeling off</Text>
					</PressableFeedback>
				</View>
				<View className="flex-row gap-2 items-center mt-auto">
					<Button
						onPress={() => router.push("/voice/new")}
						className="h-16 bg-surface px-8 flex-1"
						variant="outline"
						size="lg"
					>
						<SymbolView
							name={{ ios: "mic", android: "mic", web: "mic" }}
							tintColor={fgColor?.toString()}
							size={24}
						/>
						<Button.Label className="font-sans text-foreground">
							Start Chating...
						</Button.Label>
					</Button>
					<Button
						className="bg-surface size-16"
						variant="outline"
						size="lg"
						isIconOnly
						onPress={() => router.push("/chat/new")}
					>
						<SymbolView
							name={{ ios: "keyboard", android: "keyboard", web: "keyboard" }}
							tintColor={fgColor?.toString()}
							size={24}
						/>
					</Button>
				</View>
			</View>
		</StyledSafeAreaView>
	);
}
