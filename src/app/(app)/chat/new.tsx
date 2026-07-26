import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "@/components/chat/ChatScreen";

export default function NewChatRoute() {
	const { initial } = useLocalSearchParams<{
		initial?: string;
	}>();

	return <ChatScreen initialQuery={initial} />;
}
