import { Image } from "expo-image";
import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";
import { Switch } from "heroui-native/switch";
import { LogOutIcon, UserIcon } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledLogOutIcon = withUniwind(LogOutIcon);
const StyledUserIcon = withUniwind(UserIcon);

export default function SettingsPage() {
	const { user, signOut } = useAuth();
	const { settings, updateSettings } = useSettings();
	return (
		<StyledSafeAreaView className="flex-1 bg-background">
			<View className="flex-row gap-4 mt-4 px-6 items-center">
				{user?.photo ? (
					<Image
						style={{ width: 80, height: 80, borderRadius: 100 }}
						source={user?.photo}
					/>
				) : (
					<View className="size-20 rounded-full bg-surface justify-center items-center">
						<StyledUserIcon size={40} className="text-accent" />
					</View>
				)}
				<View>
					<Text className="font-sans-medium text-3xl">{user?.full_name}</Text>
					<Text className="font-sans text-base text-muted">{user?.email}</Text>
				</View>
			</View>
			<View className="py-4 px-6 gap-2 mt-8">
				<Text className="text-xl font-sans mb-2">Settings</Text>
				<Card>
					<Card.Body className="flex-row justify-between items-center gap-4">
						<View className="shrink">
							<Text className="font-sans text-base">
								Use camera to detect emotions
							</Text>
							<Text className="font-sans text-xs text-muted">
								Device front camera will be active in background to record your
								emotions.
							</Text>
						</View>
						<Switch
							isSelected={settings.useCameraEmotionDetection}
							onSelectedChange={(useCameraEmotionDetection) =>
								updateSettings({ useCameraEmotionDetection })
							}
						/>
					</Card.Body>
				</Card>
				{/*<Card>
					<Card.Body className="flex-row justify-between items-center gap-4">
						<View className="shrink">
							<Text className="font-sans text-base">Play ambient sounds</Text>
							<Text className="font-sans text-xs text-muted">
								Ambient sounds will play in the background while you chat.
							</Text>
						</View>
						<Switch
							isSelected={settings.playAmbientSounds}
							onSelectedChange={(playAmbientSounds) =>
								updateSettings({ playAmbientSounds })
							}
						/>
					</Card.Body>
				</Card>*/}
			</View>
			<Button className="mt-auto" onPress={signOut} variant="ghost">
				<StyledLogOutIcon size={20} className="text-danger" />
				<Text className="text-danger font-sans text-base">Log Out</Text>
			</Button>
		</StyledSafeAreaView>
	);
}
