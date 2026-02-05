import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useCSSVariable } from "uniwind";

export default function TabLayout() {
	const accentColor = useCSSVariable("--color-accent");

	return (
		<NativeTabs tintColor={accentColor?.toString()} rippleColor={"none"}>
			<NativeTabs.Trigger name="index">
				<NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon md="home" />
			</NativeTabs.Trigger>
			{/*<NativeTabs.Trigger name="insights">
				<NativeTabs.Trigger.Label>Insights</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon md="bubbles" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="journey">
				<NativeTabs.Trigger.Label>Journey</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon md="book_ribbon" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="profile">
				<NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon md="person" />
			</NativeTabs.Trigger>*/}
		</NativeTabs>
	);
}
