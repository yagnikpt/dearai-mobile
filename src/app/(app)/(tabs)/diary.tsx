import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

const StyledSafeAreaView = withUniwind(SafeAreaView);

export default function DiaryScreen() {
	return (
		<StyledSafeAreaView className="flex-1 bg-background"></StyledSafeAreaView>
	);
}
