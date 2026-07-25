import {
	AudioModule,
	RecordingPresets,
	setAudioModeAsync,
	useAudioPlayer,
	useAudioPlayerStatus,
	useAudioRecorder,
	useAudioRecorderState,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { Spinner } from "heroui-native/spinner";
import {
	ArrowLeftIcon,
	FlowerIcon,
	MicIcon,
	PauseIcon,
	SquareIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { api } from "@/lib/api";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledArrowLeftIcon = withUniwind(ArrowLeftIcon);
const StyledFlowerIcon = withUniwind(FlowerIcon);
const StyledMicIcon = withUniwind(MicIcon);
const StyledSquareIcon = withUniwind(SquareIcon);
const StyledPauseIcon = withUniwind(PauseIcon);

type ChatState = "idle" | "recording" | "sending" | "playing";

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function CompanionVoiceChat() {
	const { id, new: newChat } = useLocalSearchParams<{
		id: string;
		new?: string;
	}>();
	const router = useRouter();

	const [isNewChat, setIsNewChat] = useState(!!newChat);
	const [chatState, setChatState] = useState<ChatState>("idle");
	const [statusText, setStatusText] = useState("Tap the mic to start talking");

	const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
	const recorderState = useAudioRecorderState(audioRecorder, 100);

	const player = useAudioPlayer(null);
	const playerStatus = useAudioPlayerStatus(player);

	// Request permissions on mount
	useEffect(() => {
		(async () => {
			const status = await AudioModule.requestRecordingPermissionsAsync();
			if (!status.granted) {
				Alert.alert(
					"Microphone Access",
					"Permission to access the microphone is required for voice chat.",
					[{ text: "OK", onPress: () => router.back() }],
				);
			}
			await setAudioModeAsync({
				playsInSilentMode: true,
				allowsRecording: true,
			});
		})();
	}, [router]);

	// Track player status for playback completion
	const hasStartedPlaying = useRef(false);

	useEffect(() => {
		if (!player) return;

		if (playerStatus.playing) {
			hasStartedPlaying.current = true;
		}

		// If we were playing and now stopped, playback is complete
		console.log(hasStartedPlaying.current, playerStatus.playing, chatState);
		if (
			hasStartedPlaying.current &&
			!playerStatus.playing &&
			chatState === "playing"
		) {
			hasStartedPlaying.current = false;
			setChatState("idle");
			setStatusText("Tap the mic to continue");
		}
	}, [playerStatus.playing, chatState]);

	const startRecording = useCallback(async () => {
		try {
			await audioRecorder.prepareToRecordAsync();
			audioRecorder.record();
			setChatState("recording");
			setStatusText("Listening...");
		} catch (error) {
			console.error("Failed to start recording:", error);
			Alert.alert("Error", "Failed to start recording. Please try again.");
		}
	}, [audioRecorder]);

	const stopRecordingAndSend = useCallback(async () => {
		try {
			if (isNewChat) {
				await api.post("/conversations", { id });
			}

			await audioRecorder.stop();
			setChatState("sending");
			setStatusText("Thinking...");

			const uri = audioRecorder.uri;
			if (!uri) {
				throw new Error("No recording URI available");
			}

			// Build multipart form data with the recorded audio file
			const formData = new FormData();
			formData.append("conversation_id", id);
			formData.append("audio", {
				uri,
				type: "audio/m4a",
				name: "recording.m4a",
			} as unknown as Blob);

			const response = await api.post("/chat/voice/audio", formData, {
				responseType: "arraybuffer",
				headers: {
					"Content-Type": "multipart/form-data",
				},
			});

			if (response.status === 204) {
				Alert.alert("No response!");
				return;
			}

			// Parse the response to get the audio URL
			const responseData = new Uint8Array(response.data);
			const destFile = new File(Paths.cache, `response_${Date.now()}.mp3`);
			destFile.write(responseData);

			// Replace the player source and play the response
			player.replace({ uri: destFile.uri });
			setChatState("playing");
			setStatusText("Speaking...");
			player.play();

			if (isNewChat) setIsNewChat(false);
		} catch (error) {
			console.error("Failed to send voice message:", error);
			const message =
				error instanceof Error ? error.message : "Something went wrong";
			Alert.alert("Error", message);
			setChatState("idle");
			setStatusText("Tap the mic to try again");
		}
	}, [audioRecorder, id, player, isNewChat]);

	const handleMicPress = useCallback(() => {
		if (chatState === "idle") {
			startRecording();
		} else if (chatState === "recording") {
			stopRecordingAndSend();
		}
	}, [chatState, startRecording, stopRecordingAndSend]);

	const handleStopPlayback = useCallback(() => {
		player?.pause();
		hasStartedPlaying.current = false;
		setChatState("idle");
		setStatusText("Tap the mic to continue");
	}, [player]);

	return (
		<StyledSafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="px-4 py-2 flex-row items-center">
				<Button
					onPress={() => router.back()}
					variant="ghost"
					isIconOnly
					size="sm"
				>
					<StyledArrowLeftIcon className="text-foreground size-5" />
				</Button>
				<View className="flex-1 items-center">
					<Text className="text-base font-sans-medium text-foreground">
						Companion
					</Text>
				</View>
				{/* Spacer to balance the back button */}
				<View className="w-10" />
			</View>

			{/* Main content */}
			<View className="flex-1 items-center justify-center px-6">
				{/* Companion avatar */}
				<View className="bg-accent/10 p-6 rounded-full mb-8">
					<StyledFlowerIcon
						className={`text-accent ${chatState === "playing" ? "opacity-100" : "opacity-60"}`}
						size={48}
					/>
				</View>

				{/* Status text */}
				<Text className="text-lg font-sans-medium text-foreground mb-2">
					{statusText}
				</Text>

				{/* Recording duration */}
				{chatState === "recording" && (
					<Text className="text-sm font-sans text-muted">
						{formatDuration(recorderState.durationMillis)}
					</Text>
				)}

				{/* Sending spinner */}
				{chatState === "sending" && <Spinner size="sm" className="mt-2" />}
			</View>

			{/* Bottom controls */}
			<View className="items-center pb-12 gap-4">
				{/* Mic button with pulse animation */}
				<View className="items-center justify-center">
					{chatState === "playing" ? (
						<Button
							onPress={handleStopPlayback}
							isIconOnly
							className="w-20 h-20 rounded-full bg-danger"
						>
							<StyledPauseIcon className="text-white size-8" />
						</Button>
					) : (
						<Button
							onPress={handleMicPress}
							isIconOnly
							isDisabled={chatState === "sending"}
							className={`w-20 h-20 rounded-full ${
								chatState === "recording" ? "bg-danger" : "bg-accent"
							}`}
						>
							{chatState === "recording" ? (
								<StyledSquareIcon className="text-white size-6" />
							) : chatState === "sending" ? (
								<Spinner size="sm" className="text-white" />
							) : (
								<StyledMicIcon className="text-white size-8" />
							)}
						</Button>
					)}
				</View>

				{/* Hint text */}
				<Text className="text-xs font-sans text-muted">
					{chatState === "recording"
						? "Tap to stop"
						: chatState === "playing"
							? "Tap to stop playback"
							: chatState === "sending"
								? "Processing your message..."
								: "Tap to speak"}
				</Text>
			</View>
		</StyledSafeAreaView>
	);
}
