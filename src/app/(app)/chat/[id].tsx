import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "@/components/chat/ChatScreen";

export default function ExistingChatRoute() {
	const { id, chatTitle } = useLocalSearchParams<{
		id: string;
		chatTitle: string;
	}>();
	return <ChatScreen initialSessionId={id} chatTitle={chatTitle} />;
}
