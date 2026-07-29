import { Select } from "heroui-native/select";
import { Clock3, Info, Wind } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	Animated as NativeAnimated,
	Easing as NativeEasing,
	Pressable,
	Text,
	View,
} from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedProps,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledSvg = withUniwind(Svg);
const AnimatedG = Animated.createAnimatedComponent(G);

const phases = [
	{ label: "Inhale", seconds: 4, color: "#86aa9a" },
	{ label: "Hold", seconds: 4, color: "#9d92b7" },
	{ label: "Exhale", seconds: 6, color: "#7fa8c3" },
];
const durationOptions = [1, 3, 5, 10].map((minutes) => ({
	value: String(minutes),
	label: `${minutes} ${minutes === 1 ? "minute" : "minutes"}`,
}));
const cycleLength = phases.reduce((total, phase) => total + phase.seconds, 0);

function getBreathingState(elapsedSeconds: number) {
	const cyclePosition = elapsedSeconds % cycleLength;
	let elapsedInPhases = 0;

	for (const phase of phases) {
		if (cyclePosition < elapsedInPhases + phase.seconds) {
			return {
				phase,
				secondsLeft: elapsedInPhases + phase.seconds - cyclePosition,
			};
		}
		elapsedInPhases += phase.seconds;
	}

	return { phase: phases[0], secondsLeft: phases[0].seconds };
}

function rotationMatrix(degrees: number) {
	"worklet";
	const radians = (degrees * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);

	return [
		cosine,
		sine,
		-sine,
		cosine,
		150 - 150 * cosine + 150 * sine,
		150 - 150 * sine - 150 * cosine,
	];
}

function BreathingOrb({
	phase,
	secondsLeft,
	isRunning,
}: {
	phase: (typeof phases)[number];
	secondsLeft: number;
	isRunning: boolean;
}) {
	const [scale] = useState(() => new NativeAnimated.Value(0.82));
	const outerRotation = useSharedValue(0);
	const middleRotation = useSharedValue(0);
	const innerRotation = useSharedValue(0);

	useEffect(() => {
		if (!isRunning) {
			scale.stopAnimation();
			return;
		}

		const targetScale =
			phase.label === "Inhale" ? 1 : phase.label === "Hold" ? 1 : 0.82;
		NativeAnimated.timing(scale, {
			toValue: targetScale,
			duration: secondsLeft * 1000,
			easing: NativeEasing.inOut(NativeEasing.sin),
			useNativeDriver: true,
		}).start();
	}, [isRunning, phase.label, scale]);

	useEffect(() => {
		if (!isRunning) {
			cancelAnimation(outerRotation);
			cancelAnimation(middleRotation);
			cancelAnimation(innerRotation);
			return;
		}

		outerRotation.value = withRepeat(
			withTiming(360, { duration: 42000, easing: Easing.linear }),
			-1,
		);
		middleRotation.value = withRepeat(
			withTiming(-360, { duration: 52000, easing: Easing.linear }),
			-1,
		);
		innerRotation.value = withRepeat(
			withTiming(360, { duration: 64000, easing: Easing.linear }),
			-1,
		);
	}, [innerRotation, isRunning, middleRotation, outerRotation]);

	const outerLayerProps = useAnimatedProps(() => ({
		matrix: rotationMatrix(outerRotation.value),
	}));
	const middleLayerProps = useAnimatedProps(() => ({
		matrix: rotationMatrix(middleRotation.value),
	}));
	const innerLayerProps = useAnimatedProps(() => ({
		matrix: rotationMatrix(innerRotation.value),
	}));

	return (
		<View className="items-center justify-center h-75">
			<NativeAnimated.View style={{ transform: [{ scale }] }}>
				<StyledSvg width={300} height={300} viewBox="0 0 300 300">
					<Circle cx="150" cy="150" r="132" fill="#dbe8de" opacity={0.7} />
					<AnimatedG animatedProps={outerLayerProps as never}>
						<Path
							d="M151 15C201 23 260 53 270 113c11 62-26 125-79 151-58 28-126 5-153-43-30-54-15-119 31-155 25-20 51-20 82-11Z"
							fill="#bed9cb"
							opacity={0.62}
						/>
					</AnimatedG>
					<AnimatedG animatedProps={middleLayerProps as never}>
						<Path
							d="M155 32c53 0 102 41 108 93 6 55-29 106-79 123-53 18-113-9-133-58-21-52 5-112 48-135 18-10 36-23 56-23Z"
							fill="#92b9a8"
							opacity={0.48}
						/>
					</AnimatedG>
					<AnimatedG animatedProps={innerLayerProps as never}>
						<Path
							d="M141 45c47-5 94 25 111 69 19 50-7 109-54 132-48 24-109 1-134-45-23-44-3-104 35-127 16-10 25-27 42-29Z"
							fill="#6e9d8b"
							opacity={0.46}
						/>
					</AnimatedG>
					<Circle cx="150" cy="150" r="102" fill="#5f9581" opacity={0.3} />
					<Circle cx="150" cy="150" r="91" fill="#f9f5ee" />
					<Circle
						cx="150"
						cy="150"
						r="88"
						fill="none"
						stroke="#e3e4dc"
						strokeWidth="2"
					/>
				</StyledSvg>
			</NativeAnimated.View>
			<View className="items-center absolute">
				<Text className="font-sans text-base text-foreground">
					{phase.label}
				</Text>
				<Text className="font-sans-light text-[58px] leading-16 text-foreground">
					{secondsLeft}
				</Text>
				<Text className="font-sans text-sm text-muted">seconds</Text>
			</View>
		</View>
	);
}

export default function BreathingExperience() {
	const [durationOption, setDurationOption] = useState(durationOptions[2]);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [status, setStatus] = useState<
		"ready" | "running" | "paused" | "complete"
	>("ready");
	const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
	const durationMinutes = Number(durationOption.value);
	const totalSeconds = durationMinutes * 60;
	const { phase, secondsLeft } = getBreathingState(elapsedSeconds);

	useEffect(() => {
		if (status !== "running") return;

		const timer = setInterval(() => {
			setElapsedSeconds((current) => {
				if (current + 1 >= totalSeconds) {
					setStatus("complete");
					return totalSeconds;
				}
				return current + 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [status, totalSeconds]);

	const handleDurationChange = (
		value: (typeof durationOptions)[number] | undefined,
	) => {
		if (!value) return;
		setDurationOption(value);
		setElapsedSeconds(0);
		setStatus("ready");
	};

	const handleExercisePress = () => {
		setIsDurationMenuOpen(false);
		if (status === "running") {
			setStatus("paused");
			return;
		}
		if (status === "complete") setElapsedSeconds(0);
		setStatus("running");
	};

	const actionLabel =
		status === "running"
			? "Pause Exercise"
			: status === "paused"
				? "Resume Exercise"
				: status === "complete"
					? "Start Again"
					: "Start Exercise";

	return (
		<StyledSafeAreaView className="flex-1 bg-background">
			<View className="flex-1 px-6 pt-3">
				<View className="items-center mt-6">
					<Text className="font-serif text-[29px] text-foreground">
						Take a deep breath <Text className="text-[23px]">🌿</Text>
					</Text>
					<Text className="font-sans text-base text-muted mt-1">
						You’re in the right place.
					</Text>
				</View>

				<BreathingOrb
					phase={phase}
					secondsLeft={status === "complete" ? 0 : secondsLeft}
					isRunning={status === "running"}
				/>

				<View className="bg-surface rounded-3xl px-4 pt-0 pb-5 shadow-sm border border-border mt-auto">
					<View className="self-center -translate-y-1/2 bg-surface px-5 h-10 rounded-full border border-border flex-row items-center gap-1">
						<Text className="font-sans-medium text-base text-foreground">
							4 - 4 - 6 Breathing
						</Text>
						<Info size={16} color="#7b827a" strokeWidth={1.8} />
					</View>

					<View className="flex-row mb-5">
						{phases.map((phase, index) => (
							<View
								key={phase.label}
								className={`flex-1 items-center ${index < phases.length - 1 ? "border-r border-border" : ""}`}
							>
								{index === 0 ? (
									<Wind size={23} color={phase.color} strokeWidth={1.7} />
								) : index === 1 ? (
									<Clock3 size={22} color={phase.color} strokeWidth={1.7} />
								) : (
									<Wind size={23} color={phase.color} strokeWidth={1.7} />
								)}
								<Text className="font-sans-medium text-sm text-foreground mt-2">
									{phase.label}
								</Text>
								<View className="flex-row items-center mt-1 gap-1">
									<Text className="font-sans text-xs text-muted">
										{phase.seconds} sec
									</Text>
									<View
										className="w-2 h-2 rounded-full"
										style={{ backgroundColor: phase.color }}
									/>
								</View>
							</View>
						))}
					</View>

					<Select
						value={durationOption}
						onValueChange={handleDurationChange}
						isOpen={isDurationMenuOpen}
						onOpenChange={setIsDurationMenuOpen}
						isDisabled={status === "running"}
						className="items-center"
						presentation="bottom-sheet"
					>
						<Select.Trigger
							variant="unstyled"
							className="h-11 w-48 px-5 rounded-full border border-border flex-row items-center gap-3 justify-center"
						>
							<Clock3 size={19} color="#333833" strokeWidth={1.8} />
							<Select.Value
								placeholder="Choose duration"
								className="font-sans text-base text-foreground"
							/>
							<Select.TriggerIndicator
								iconProps={{ color: "#333833", size: 18 }}
							/>
						</Select.Trigger>
						<Select.Portal>
							<Select.Overlay />
							<Select.Content
								presentation="bottom-sheet"
								snapPoints={["35%"]}
								className="rounded-4xl border border-border bg-surface p-2"
							>
								<Select.ListLabel className="font-sans-medium text-sm text-muted px-3 py-2">
									Exercise duration
								</Select.ListLabel>
								{durationOptions.map((option) => (
									<Select.Item
										key={option.value}
										value={option.value}
										label={option.label}
										className="rounded-xl"
									>
										<Select.ItemLabel className="font-sans text-foreground" />
										<Select.ItemIndicator />
									</Select.Item>
								))}
							</Select.Content>
						</Select.Portal>
					</Select>

					<Pressable
						onPress={handleExercisePress}
						className="h-16 bg-accent rounded-full mt-5 items-center justify-center"
						accessibilityRole="button"
					>
						<Text className="font-sans-medium text-lg text-accent-foreground">
							{actionLabel}
						</Text>
					</Pressable>
				</View>
			</View>
		</StyledSafeAreaView>
	);
}
