import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "@/components/chat/ChatScreen";

export default function ExistingChatRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <ChatScreen initialSessionId={id} />;
}
