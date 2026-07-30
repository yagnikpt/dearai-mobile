import { faceCropper } from "@dearai/vision-camera-face-cropper";
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
import {
	ScalarType,
	type TensorPtr,
	useExecutorchModule,
} from "react-native-executorch";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	useCamera,
	useCameraDevice,
	useCameraPermission,
	useFrameOutput,
} from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { scheduleOnRN } from "react-native-worklets";
import { withUniwind } from "uniwind";
import { useAmbientMusic } from "@/context/AmbientMusicContext";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { createChatWebSocketUrl } from "@/lib/api";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledArrowLeftIcon = withUniwind(ArrowLeftIcon);
const StyledFlowerIcon = withUniwind(FlowerIcon);
const StyledMicIcon = withUniwind(MicIcon);
const StyledPauseIcon = withUniwind(PauseIcon);
const StyledSendIcon = withUniwind(SendIcon);
const StyledSquareIcon = withUniwind(SquareIcon);

const MODEL_INPUT_SIZE = 224;
const INFERENCE_SETTLE_MS = 500;
const EMOTIONS = [
	"Anger",
	"Contempt",
	"Disgust",
	"Fear",
	"Happiness",
	"Neutral",
	"Sadness",
	"Surprise",
] as const;

type Emotion = (typeof EMOTIONS)[number];

function getFloat32Values(tensor: TensorPtr): Float32Array {
	if (tensor.scalarType !== ScalarType.FLOAT) {
		throw new Error(
			`Expected Float32 output, received scalar type ${tensor.scalarType}.`,
		);
	}

	if (tensor.dataPtr instanceof Float32Array) return tensor.dataPtr;
	if (tensor.dataPtr instanceof ArrayBuffer)
		return new Float32Array(tensor.dataPtr);

	if (ArrayBuffer.isView(tensor.dataPtr)) {
		return new Float32Array(
			tensor.dataPtr.buffer,
			tensor.dataPtr.byteOffset,
			tensor.dataPtr.byteLength / Float32Array.BYTES_PER_ELEMENT,
		);
	}

	throw new Error("Model output does not expose an ArrayBuffer.");
}

function getPredictedEmotion(logits: Float32Array): Emotion {
	let bestIndex = 0;
	for (let index = 1; index < logits.length; index += 1) {
		if (logits[index] > logits[bestIndex]) bestIndex = index;
	}
	return EMOTIONS[bestIndex];
}

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
	const { setTemporarilyPaused } = useAmbientMusic();

	useEffect(() => {
		setTemporarilyPaused(true);
		return () => setTemporarilyPaused(false);
	}, [setTemporarilyPaused]);

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

	const { settings } = useSettings();
	const { useCameraEmotionDetection } = settings;

	const device = useCameraDevice("front");
	const { hasPermission, requestPermission } = useCameraPermission();
	const faceDetector = useFaceDetector();
	const emotionHistoryRef = useRef<Emotion[]>([]);
	const inferenceInFlight = useRef(false);

	const {
		error: modelError,
		forward,
		isGenerating,
		isReady,
	} = useExecutorchModule({
		modelSource: require("@/assets/emotion_model.pte"),
	});
	const modelState = useRef({ forward, isGenerating, isReady });
	modelState.current = { forward, isGenerating, isReady };

	useEffect(() => {
		if (useCameraEmotionDetection && !hasPermission) {
			requestPermission();
		}
	}, [hasPermission, requestPermission, useCameraEmotionDetection]);

	const runInference = useCallback(
		async (data: ArrayBuffer, width: number, height: number) => {
			const currentModel = modelState.current;
			if (
				!currentModel.isReady ||
				currentModel.isGenerating ||
				inferenceInFlight.current
			) {
				return;
			}

			inferenceInFlight.current = true;
			try {
				const output = await currentModel.forward([
					{
						dataPtr: data,
						sizes: [1, 3, height, width],
						scalarType: ScalarType.FLOAT,
					},
				]);
				const logits = output[0] == null ? null : getFloat32Values(output[0]);
				if (logits == null || logits.length !== 8) return;

				const emotion = getPredictedEmotion(logits);
				emotionHistoryRef.current.push(emotion);
			} catch (error) {
				console.error("Emotion model inference failed:", error);
			} finally {
				setTimeout(() => {
					inferenceInFlight.current = false;
				}, INFERENCE_SETTLE_MS);
			}
		},
		[],
	);

	const isRecordingShared = useSharedValue(isRecording);
	useEffect(() => {
		isRecordingShared.value = isRecording;
	}, [isRecording, isRecordingShared]);

	const frameOutput = useFrameOutput({
		pixelFormat: "yuv",
		onFrame(frame) {
			"worklet";
			if (!isRecordingShared.value) {
				frame.dispose();
				return;
			}
			try {
				const faces = faceDetector.detectFaces(frame);
				const bounds = faces[0]?.bounds;
				if (bounds == null) return;

				const tensor = faceCropper.cropFace(
					frame,
					bounds.x,
					bounds.y,
					bounds.width,
					bounds.height,
					MODEL_INPUT_SIZE,
					MODEL_INPUT_SIZE,
				);
				if (tensor == null) return;

				try {
					scheduleOnRN(runInference, tensor.data, tensor.width, tensor.height);
				} catch (error) {
					console.error("Failed to schedule inference on RN:", error);
				}
			} finally {
				frame.dispose();
			}
		},
	});

	if (!device) return null;

	useCamera({
		device: device,
		isActive: Boolean(useCameraEmotionDetection && hasPermission && isReady),
		outputs: [frameOutput],
		constraints: [{ fps: 2 }],
	});

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
		async (base64Audio: string) => {
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
					setStatusText(
						"We couldn't understand the response. Please try again.",
					);
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
				interruptionMode: "mixWithOthers",
				shouldRouteThroughEarpiece: false,
			});
		}

		configureAudio().catch(() => {
			setStatusText("Microphone setup failed. Please try again.");
		});
	}, [router]);

	useEffect(() => {
		if (playerStatus.error) {
			console.error("[VoiceChat] Audio player error:", playerStatus.error);
			isAudioPlayingRef.current = false;
			playNextAudio();
			return;
		}
		if (!playerStatus.didJustFinish) return;
		isAudioPlayingRef.current = false;
		playNextAudio();
	}, [playNextAudio, playerStatus.didJustFinish, playerStatus.error]);

	const startRecording = useCallback(async () => {
		try {
			player.pause();
			audioQueueRef.current = [];
			isAudioPlayingRef.current = false;
			setIsPlaying(false);
			emotionHistoryRef.current = [];
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
			const payload: Record<string, unknown> = {
				audio,
				voice_mode: true,
				voice: "en-US-Studio-O",
				session_id: activeSessionIdRef.current,
			};
			if (useCameraEmotionDetection && emotionHistoryRef.current.length > 0) {
				payload.emotions = [...emotionHistoryRef.current];
			}
			socket.send(JSON.stringify(payload));
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
