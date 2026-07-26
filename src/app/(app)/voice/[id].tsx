import { useLocalSearchParams } from "expo-router";

import { VoiceChatScreen } from "@/components/voice/VoiceChatScreen";

export default function ExistingVoiceRoute() {
	const { id, chatTitle } = useLocalSearchParams<{
		id: string;
		chatTitle?: string;
	}>();
	return <VoiceChatScreen initialSessionId={id} chatTitle={chatTitle} />;
}
