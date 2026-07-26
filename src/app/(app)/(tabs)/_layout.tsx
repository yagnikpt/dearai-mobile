import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useCSSVariable } from "uniwind";

export default function TabLayout() {
	const accentColor = useCSSVariable("--color-accent");

	return (
		<NativeTabs tintColor={accentColor?.toString()} rippleColor={"none"}>
			<NativeTabs.Trigger name="index">
				<NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					md={{ default: "home", selected: "home_filled" }}
				/>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="chats">
				<NativeTabs.Trigger.Label>Conversations</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon md="chat" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="breathing">
				<NativeTabs.Trigger.Label>Breathe</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon md="airwave" />
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
