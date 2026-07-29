import { faceCropper } from "@dearai/vision-camera-face-cropper";
import { useIsFocused } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
	ScalarType,
	type TensorPtr,
	useExecutorchModule,
} from "react-native-executorch";
import {
	Images,
	NitroImage,
	type Image as NitroImageData,
} from "react-native-nitro-image";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	useCamera,
	// Camera,
	useCameraDevice,
	useCameraPermission,
	useFrameOutput,
} from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { scheduleOnRN } from "react-native-worklets";

// Retained as a manual camera-tensor diagnostic outside the app router.
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

	// This branch is defensive: a Float32 tensor should use one of the two
	// representations above. A view still lets us avoid copying if it is returned.
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

function createTensorPreview(
	tensorData: ArrayBuffer,
	width: number,
	height: number,
): NitroImageData {
	const pixels = new Float32Array(tensorData);
	const pixelCount = width * height;
	if (pixels.length !== pixelCount * 3) {
		throw new Error("Face tensor size does not match its dimensions.");
	}

	// The tensor has one plane per channel; display APIs expect RGBA pixels.
	const rgba = new Uint8Array(pixelCount * 4);
	for (let index = 0; index < pixelCount; index += 1) {
		const destination = index * 4;
		rgba[destination] = Math.round(
			Math.max(0, Math.min(1, pixels[index])) * 255,
		);
		rgba[destination + 1] = Math.round(
			Math.max(0, Math.min(1, pixels[pixelCount + index])) * 255,
		);
		rgba[destination + 2] = Math.round(
			Math.max(0, Math.min(1, pixels[pixelCount * 2 + index])) * 255,
		);
		rgba[destination + 3] = 255;
	}

	return Images.loadFromRawPixelData({
		buffer: rgba.buffer,
		width,
		height,
		pixelFormat: "RGBA",
	});
}

export default function TestEmotionDetection() {
	const device = useCameraDevice("front");
	const isFocused = useIsFocused();
	const { hasPermission, requestPermission } = useCameraPermission();

	const faceDetector = useFaceDetector();
	const [status, setStatus] = useState("Loading emotion model…");
	const [emotionHistory, setEmotionHistory] = useState<Emotion[]>([]);
	const [previewImage, setPreviewImage] = useState<NitroImageData>();
	const inferenceInFlight = useRef(false);

	const { error, forward, isGenerating, isReady } = useExecutorchModule({
		modelSource: require("@/assets/emotion_model.pte"),
	});
	const modelState = useRef({ forward, isGenerating, isReady });
	modelState.current = { forward, isGenerating, isReady };

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
				try {
					setPreviewImage(createTensorPreview(data, width, height));
				} catch (previewError) {
					console.warn("Failed to render face tensor preview:", previewError);
				}

				const output = await currentModel.forward([
					{
						dataPtr: data,
						sizes: [1, 3, height, width],
						scalarType: ScalarType.FLOAT,
					},
				]);
				const logits = output[0] == null ? null : getFloat32Values(output[0]);
				if (logits == null || logits.length !== 8) {
					throw new Error(
						`Expected one tensor with 8 logits, received ${logits?.length ?? 0}.`,
					);
				}

				const emotion = getPredictedEmotion(logits);
				setEmotionHistory((previous) => [...previous, emotion].slice(-3));
				setStatus(`Latest emotion: ${emotion}`);
			} catch (error) {
				setStatus("Inference failed; see console for details.");
				console.error("Emotion model inference failed:", error);
			} finally {
				// `forward()` schedules a React state update before its Promise resolves.
				// Keep the gate closed briefly so the next camera frame observes that update.
				setTimeout(() => {
					inferenceInFlight.current = false;
				}, INFERENCE_SETTLE_MS);
			}
		},
		[],
	);

	const frameOutput = useFrameOutput({
		pixelFormat: "yuv",
		onFrame(frame) {
			"worklet";
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

				// `forward()` belongs to the React Native runtime, not the frame
				// worklet runtime. The tensor is fully native-owned before this hop.
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

	useEffect(() => {
		if (!hasPermission) {
			requestPermission();
		}
	}, [hasPermission, requestPermission]);

	useEffect(() => {
		if (error != null) {
			setStatus(`Model load failed: ${error.message}`);
		} else if (isReady) {
			setStatus("Emotion model ready.");
		} else {
			setStatus("Loading emotion model…");
		}
	}, [error, isReady]);

	useCamera({
		device: device ?? "front",
		isActive: isFocused,
		outputs: [frameOutput],
		constraints: [{ fps: 2 }],
	});

	return (
		<SafeAreaView style={{ flex: 1 }}>
			<Text style={styles.status}>{status}</Text>
			<Text style={styles.history}>
				Recent emotions:{" "}
				{emotionHistory.length === 0
					? "Waiting for a face…"
					: emotionHistory.join(" → ")}
			</Text>
			<View style={styles.previewContainer} pointerEvents="none">
				<Text style={styles.previewLabel}>Face crop</Text>
				{previewImage != null && (
					<NitroImage
						image={previewImage}
						resizeMode="contain"
						style={styles.previewImage}
					/>
				)}
			</View>
			{/*{hasPermission && device && (
				<Camera
					style={StyleSheet.absoluteFill}
					isActive={isFocused}
					device={device}
					constraints={[{ fps: 2 }]}
					outputs={[frameOutput]}
				/>
			)}*/}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	status: {
		backgroundColor: "rgba(0, 0, 0, 0.65)",
		color: "white",
		padding: 12,
		zIndex: 1,
	},
	history: {
		backgroundColor: "rgba(0, 0, 0, 0.65)",
		color: "white",
		paddingHorizontal: 12,
		paddingBottom: 12,
		zIndex: 1,
	},
	previewContainer: {
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.75)",
		bottom: 24,
		padding: 6,
		position: "absolute",
		right: 16,
		zIndex: 2,
	},
	previewLabel: {
		color: "white",
		fontSize: 12,
		marginBottom: 4,
	},
	previewImage: {
		height: 112,
		width: 112,
	},
});
