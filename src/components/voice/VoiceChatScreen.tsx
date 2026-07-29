import {
	AudioModule,
	RecordingPresets,
	setAudioModeAsync,
	useAudioPlayer,
	useAudioPlayerStatus,
	useAudioRecorder,
	useAudioRecorderState,
} from "expo-audio";
import { EncodingType, File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import {
	ArrowLeftIcon,
	FlowerIcon,
	MicIcon,
	PauseIcon,
	SendIcon,
	SquareIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { useAuth } from "@/context/AuthContext";
import { createChatWebSocketUrl } from "@/lib/api";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledArrowLeftIcon = withUniwind(ArrowLeftIcon);
const StyledFlowerIcon = withUniwind(FlowerIcon);
const StyledMicIcon = withUniwind(MicIcon);
const StyledPauseIcon = withUniwind(PauseIcon);
const StyledSendIcon = withUniwind(SendIcon);
const StyledSquareIcon = withUniwind(SquareIcon);

type VoiceSocketEvent = {
	layer:
		| "session_id"
		| "transcript"
		| "immediate"
		| "rag"
		| "audio"
		| "emergency"
		| "irrelevant";
	content?: string;
	audio?: string;
	final?: boolean;
};

function formatDuration(durationMillis: number) {
	const seconds = Math.floor(durationMillis / 1000);
	return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function createAudioFileName() {
	return `dearai-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
}

export function VoiceChatScreen({
	initialSessionId,
	chatTitle,
}: {
	initialSessionId?: string;
	chatTitle?: string;
}) {
	const router = useRouter();
	const { session } = useAuth();
	const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
	const recorderState = useAudioRecorderState(recorder, 100);
	const player = useAudioPlayer(null);
	const playerStatus = useAudioPlayerStatus(player);
	const socketRef = useRef<WebSocket | null>(null);
	const audioQueueRef = useRef<string[]>([]);
	const isAudioPlayingRef = useRef(false);
	const activeSessionIdRef = useRef(initialSessionId);
	const responseFinishedRef = useRef(false);
	const hasAudioResponseRef = useRef(false);
	const retryCountRef = useRef(0);
	const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [statusText, setStatusText] = useState("Connecting to Dear AI...");
	const [transcript, setTranscript] = useState<string | null>(null);
	const [responseText, setResponseText] = useState<string | null>(null);

	const appendResponseText = useCallback((content: string) => {
		if (!content) return;
		setResponseText((current) => `${current ?? ""}${content}`);
	}, []);

	const playNextAudio = useCallback(() => {
		if (isAudioPlayingRef.current) return;

		const nextAudioUri = audioQueueRef.current.shift();
		if (!nextAudioUri) {
			setIsPlaying(false);
			if (responseFinishedRef.current) setStatusText("Tap the mic to continue");
			return;
		}

		isAudioPlayingRef.current = true;
		player.replace({ uri: nextAudioUri });
		player.play();
		setIsPlaying(true);
		setStatusText("Speaking...");
	}, [player]);

	const enqueueAudio = useCallback(
		(base64Audio: string) => {
			const audioFile = new File(Paths.cache, createAudioFileName());
			audioFile.write(base64Audio, { encoding: EncodingType.Base64 });
			audioQueueRef.current.push(audioFile.uri);
			hasAudioResponseRef.current = true;
			playNextAudio();
		},
		[playNextAudio],
	);

	useEffect(() => {
		if (!session) return;

		const MAX_RETRIES = 5;

		function connect() {
			const socket = new WebSocket(createChatWebSocketUrl(session!));
			socketRef.current = socket;

			socket.onopen = () => {
				retryCountRef.current = 0;
				setIsConnected(true);
				setStatusText("Tap the mic to start talking");
			};

			socket.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data) as VoiceSocketEvent;

					if (message.layer === "session_id" && message.content) {
						activeSessionIdRef.current = message.content;
					}
					if (message.layer === "transcript") {
						setTranscript(message.content ?? null);
					}
					if (message.layer === "immediate") {
						setStatusText(message.content ?? "Thinking...");
					}
					if (message.layer === "rag") {
						appendResponseText(message.content ?? "");
					}
					if (message.layer === "audio" && message.audio) {
						enqueueAudio(message.audio);
					}
					if (message.layer === "emergency" || message.layer === "irrelevant") {
						appendResponseText(message.content ?? "");
					}
					if (message.final) {
						responseFinishedRef.current = true;
						setIsSending(false);
						if (!hasAudioResponseRef.current) {
							setStatusText("Tap the mic to continue");
						}
					}
				} catch {
					setIsSending(false);
					setStatusText("We couldn't understand the response. Please try again.");
				}
			};

			socket.onerror = () => {
				setIsConnected(false);
				setIsSending(false);
				// Reconnect handled in onclose
			};

			socket.onclose = () => {
				if (socketRef.current !== socket) return;
				setIsConnected(false);
				if (retryCountRef.current < MAX_RETRIES) {
					const delay = Math.min(1000 * 2 ** retryCountRef.current, 16_000);
					retryCountRef.current += 1;
					setStatusText(
						`Reconnecting... (attempt ${retryCountRef.current}/${MAX_RETRIES})`,
					);
					retryTimeoutRef.current = setTimeout(() => {
						if (socketRef.current === socket || socketRef.current == null) {
							connect();
						}
					}, delay);
				} else {
					setStatusText("Couldn't connect. Please go back and try again.");
				}
			};
		}

		connect();

		return () => {
			if (retryTimeoutRef.current != null) {
				clearTimeout(retryTimeoutRef.current);
				retryTimeoutRef.current = null;
			}
			const socket = socketRef.current;
			if (socket) {
				socketRef.current = null; // Prevent onclose from scheduling a retry.
				socket.close();
			}
		};
	}, [appendResponseText, enqueueAudio, session]);

	useEffect(() => {
		async function configureAudio() {
			const permission = await AudioModule.requestRecordingPermissionsAsync();
			if (!permission.granted) {
				Alert.alert(
					"Microphone access needed",
					"Allow microphone access to speak with Dear AI.",
					[{ text: "Go back", onPress: () => router.back() }],
				);
				return;
			}
			await setAudioModeAsync({
				allowsRecording: true,
				playsInSilentMode: true,
			});
		}

		configureAudio().catch(() => {
			setStatusText("Microphone setup failed. Please try again.");
		});
	}, [router]);

	useEffect(() => {
		if (!playerStatus.didJustFinish) return;
		isAudioPlayingRef.current = false;
		playNextAudio();
	}, [playNextAudio, playerStatus.didJustFinish]);

	const startRecording = useCallback(async () => {
		try {
			player.pause();
			audioQueueRef.current = [];
			isAudioPlayingRef.current = false;
			setIsPlaying(false);
			await recorder.prepareToRecordAsync();
			recorder.record();
			setIsRecording(true);
			setStatusText("Listening...");
		} catch {
			setStatusText("Couldn't start recording. Please try again.");
		}
	}, [player, recorder]);

	const stopRecordingAndSend = useCallback(async () => {
		try {
			await recorder.stop();
			setIsRecording(false);
			setIsSending(true);
			setStatusText("Sending your voice note...");

			const recordingUri = recorder.uri;
			if (!recordingUri) throw new Error("No recording was captured.");

			const socket = socketRef.current;
			if (!socket || socket.readyState !== WebSocket.OPEN) {
				throw new Error("The chat connection is unavailable.");
			}

			responseFinishedRef.current = false;
			hasAudioResponseRef.current = false;
			audioQueueRef.current = [];
			isAudioPlayingRef.current = false;
			setTranscript(null);
			setResponseText(null);
			const audio = await new File(recordingUri).base64();
			socket.send(
				JSON.stringify({
					audio,
					voice_mode: true,
					voice: "en-US-Studio-O",
					session_id: activeSessionIdRef.current,
				}),
			);
			setStatusText("Thinking...");
		} catch (error) {
			setIsRecording(false);
			setIsSending(false);
			setStatusText(
				error instanceof Error
					? error.message
					: "Couldn't send your voice note.",
			);
		}
	}, [recorder]);

	const handlePrimaryAction = useCallback(() => {
		if (isRecording) {
			stopRecordingAndSend();
			return;
		}
		if (isPlaying) {
			player.pause();
			audioQueueRef.current = [];
			isAudioPlayingRef.current = false;
			setIsPlaying(false);
			setStatusText("Response paused");
			return;
		}
		startRecording();
	}, [isPlaying, isRecording, player, startRecording, stopRecordingAndSend]);

	const isDisabled = !isConnected || isSending;

	return (
		<StyledSafeAreaView className="flex-1 bg-background">
			<View className="flex-row items-center border-b border-border px-5 py-3">
				<Pressable
					onPress={() => router.back()}
					hitSlop={12}
					className="size-10 items-center justify-center"
				>
					<StyledArrowLeftIcon className="size-5 text-foreground" />
				</Pressable>
				<Text className="flex-1 text-center font-sans-medium text-base text-foreground">
					{chatTitle || "Voice conversation"}
				</Text>
				<View className="size-10" />
			</View>

			<View className="flex-1 items-center justify-center px-6">
				<View
					className={`mb-8 size-32 items-center justify-center rounded-full ${
						isRecording
							? "bg-danger/15"
							: isPlaying
								? "bg-accent/20"
								: "bg-accent/10"
					}`}
				>
					<StyledFlowerIcon
						className={isRecording ? "text-danger" : "text-accent"}
						size={58}
					/>
				</View>
				<Text className="text-center font-sans-medium text-xl text-foreground">
					{statusText}
				</Text>
				{isRecording && (
					<Text className="mt-2 font-sans text-sm text-danger">
						{formatDuration(recorderState.durationMillis)}
					</Text>
				)}

				{(transcript || responseText) && (
					<View className="mt-8 w-full gap-3">
						{transcript && (
							<View className="rounded-2xl border border-border bg-surface px-4 py-3">
								<Text className="font-sans-medium text-xs uppercase text-muted">
									You said
								</Text>
								<Text className="mt-1 font-sans leading-6 text-foreground">
									{transcript}
								</Text>
							</View>
						)}
						{responseText && (
							<View className="rounded-2xl bg-accent/10 px-4 py-3">
								<Text className="font-sans-medium text-xs uppercase text-accent">
									Dear AI
								</Text>
								<Text className="mt-1 font-sans leading-6 text-foreground">
									{responseText}
								</Text>
							</View>
						)}
					</View>
				)}
			</View>

			<View className="items-center gap-4 pb-10">
				<Pressable
					onPress={handlePrimaryAction}
					disabled={isDisabled}
					accessibilityRole="button"
					accessibilityLabel={
						isRecording
							? "Send voice recording"
							: isPlaying
								? "Pause response"
								: "Start voice recording"
					}
					className={`size-20 items-center justify-center rounded-full ${
						isDisabled ? "bg-muted/40" : isRecording ? "bg-danger" : "bg-accent"
					}`}
				>
					{isRecording ? (
						<StyledSquareIcon className="size-7 text-white" />
					) : isPlaying ? (
						<StyledPauseIcon className="size-8 text-accent-foreground" />
					) : isSending ? (
						<StyledSendIcon className="size-7 text-accent-foreground" />
					) : (
						<StyledMicIcon className="size-8 text-accent-foreground" />
					)}
				</Pressable>
				<Text className="font-sans text-xs text-muted">
					{isRecording
						? "Tap to send"
						: isPlaying
							? "Tap to pause"
							: isSending
								? "Processing your message..."
								: "Tap to speak"}
				</Text>
			</View>
		</StyledSafeAreaView>
	);
}
