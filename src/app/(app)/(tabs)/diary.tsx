import { useRouter } from "expo-router";
import { Separator } from "heroui-native/separator";
import { Spinner } from "heroui-native/spinner";
import { useToast } from "heroui-native/toast";
import {
	BookHeartIcon,
	ChevronRightIcon,
	CircleCheckIcon,
	CircleXIcon,
	FileTextIcon,
	RefreshCwIcon,
	SaveIcon,
	SparklesIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { api } from "@/lib/api";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledBookHeartIcon = withUniwind(BookHeartIcon);
const StyledChevronRightIcon = withUniwind(ChevronRightIcon);
const StyledFileTextIcon = withUniwind(FileTextIcon);
const StyledRefreshCwIcon = withUniwind(RefreshCwIcon);
const StyledSaveIcon = withUniwind(SaveIcon);
const StyledSparklesIcon = withUniwind(SparklesIcon);
const StyledCircleCheckIcon = withUniwind(CircleCheckIcon);
const StyledCircleXIcon = withUniwind(CircleXIcon);

type DiaryEntry = {
	created_at: string;
	id: string;
	title: string;
	content: string;
	updated_at: string;
	user_id: string;
};

type GenerateDiaryResponse = {
	message: string;
	entry: DiaryEntry;
};

function asUtcDate(dateString: string) {
	return new Date(
		/(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateString) ? dateString : `${dateString}Z`,
	);
}

function formatEntryDate(dateString: string) {
	const date = asUtcDate(dateString);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

async function getDiaryEntries() {
	const response = await api.get<DiaryEntry[]>("/api/diary", {
		params: { limit: 100 },
	});
	return response.data;
}

export default function DiaryScreen() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [entries, setEntries] = useState<DiaryEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { toast } = useToast();

	const loadEntries = async (refresh = false) => {
		if (refresh) setIsRefreshing(true);
		setError(null);

		try {
			setEntries(await getDiaryEntries());
		} catch {
			setError("We couldn't load your diary entries. Please try again.");
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	};

	useEffect(() => {
		let cancelled = false;

		getDiaryEntries()
			.then((data) => {
				if (!cancelled) setEntries(data);
			})
			.catch(() => {
				if (!cancelled)
					setError("We couldn't load your diary entries. Please try again.");
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const saveEntry = async () => {
		const trimmedTitle = title.trim();
		const trimmedContent = content.trim();
		if (!trimmedTitle || !trimmedContent) {
			toast.show({
				variant: "danger",
				label: "Add a title and reflection",
				description: "Both fields are needed to save your entry.",
				icon: <StyledCircleXIcon className="text-danger" />,
			});
			return;
		}

		setIsSaving(true);
		try {
			const response = await api.post<DiaryEntry>("/api/diary", {
				title: trimmedTitle,
				content: trimmedContent,
			});
			setEntries((current) => [response.data, ...current]);
			setTitle("");
			setContent("");
		} catch {
			toast.show({
				variant: "danger",
				label: "Unable to generate entry",
				description: "Please check your connection and try again.",
				icon: <StyledCircleXIcon className="text-danger" />,
			});
		} finally {
			setIsSaving(false);
		}
	};

	const generateEntry = async () => {
		setIsGenerating(true);
		try {
			const response = await api.post<GenerateDiaryResponse>(
				"/api/agent/summarize-to-diary",
			);
			if (response.data.entry)
				setEntries((current) => [response.data.entry, ...current]);

			toast.show({
				variant: response.data.entry ? "success" : "danger",
				label: response.data.entry
					? "Diary entry created"
					: "Unable to generate entry",
				description: response.data.message,
				icon: response.data.entry ? (
					<StyledCircleCheckIcon className="text-success" />
				) : (
					<StyledCircleXIcon className="text-danger" />
				),
			});
		} catch {
			toast.show({
				variant: "danger",
				label: "Unable to generate entry",
				description:
					"There may not be enough recent chat activity yet. Please try again later.",
				icon: <StyledCircleXIcon className="text-danger" />,
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<StyledSafeAreaView edges={["top"]} className="flex-1 bg-background">
			<ScrollView
				className="flex-1"
				contentContainerClassName="px-6 pb-10"
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={() => loadEntries(true)}
					/>
				}
			>
				<View className="items-center pt-5 pb-6">
					<View className="size-12 items-center justify-center rounded-full bg-accent/10">
						<StyledBookHeartIcon className="text-accent" size={24} />
					</View>
					<Text className="mt-3 font-serif text-3xl text-foreground">
						Diary
					</Text>
					<Text className="mt-1 font-sans text-sm text-muted">{today}</Text>
				</View>

				<View className="rounded-3xl border border-border bg-surface p-4">
					<Text className="font-sans-medium text-base text-foreground">
						How are you feeling today?
					</Text>
					<TextInput
						value={title}
						onChangeText={setTitle}
						placeholder="Give this entry a title"
						placeholderTextColor="#8a8680"
						returnKeyType="next"
						className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 font-sans text-base text-foreground"
					/>
					<TextInput
						value={content}
						onChangeText={setContent}
						placeholder="Write your thoughts here..."
						placeholderTextColor="#8a8680"
						multiline
						textAlignVertical="top"
						className="mt-3 min-h-40 rounded-2xl border border-border bg-background px-4 py-4 font-sans text-base leading-6 text-foreground"
					/>
					<Pressable
						onPress={saveEntry}
						disabled={isSaving || isGenerating}
						accessibilityRole="button"
						className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 disabled:opacity-50 mt-4"
					>
						{isSaving ? (
							<Spinner color="#ffffff" />
						) : (
							<StyledSaveIcon className="text-accent-foreground" size={18} />
						)}
						<Text className="font-sans-medium text-accent-foreground">
							Save entry
						</Text>
					</Pressable>

					<View className="flex-row gap-2 items-center mt-4">
						<Separator className="flex-1" />
						<Text className="font-sans text-muted">OR</Text>
						<Separator className="flex-1" />
					</View>
					<Pressable
						onPress={generateEntry}
						disabled={isSaving || isGenerating}
						accessibilityRole="button"
						accessibilityLabel="Generate a diary entry from recent chats"
						className="flex-1 flex-row items-center justify-center gap-2 mt-4 rounded-2xl border border-accent bg-accent/10 py-3.5 disabled:opacity-50"
					>
						{isGenerating ? (
							<Spinner />
						) : (
							<StyledSparklesIcon className="text-accent" size={18} />
						)}
						<Text className="font-sans-medium text-accent">
							Generate from chats
						</Text>
					</Pressable>
				</View>

				<View className="mt-8 flex-row items-center justify-between">
					<Text className="font-sans-medium text-lg text-foreground">
						Previous entries
					</Text>
					{error ? (
						<Pressable
							onPress={() => loadEntries()}
							accessibilityRole="button"
							className="flex-row items-center gap-1"
						>
							<StyledRefreshCwIcon className="text-accent" size={15} />
							<Text className="font-sans-medium text-sm text-accent">
								Retry
							</Text>
						</Pressable>
					) : null}
				</View>

				{isLoading ? (
					<View className="items-center py-12">
						<Spinner size="lg" />
					</View>
				) : error ? (
					<Text className="py-6 font-sans text-muted">{error}</Text>
				) : entries.length === 0 ? (
					<View className="items-center rounded-3xl border border-border bg-surface px-6 py-10 mt-3">
						<StyledFileTextIcon className="text-muted" size={28} />
						<Text className="mt-3 font-sans-medium text-foreground">
							No entries yet
						</Text>
						<Text className="mt-1 text-center font-sans text-sm text-muted">
							Write a reflection or generate one from your recent chats.
						</Text>
					</View>
				) : (
					<View className="mt-3 gap-3">
						{entries.map((entry) => (
							<Pressable
								key={entry.id}
								onPress={() =>
									router.push({
										pathname: "/diary/[id]",
										params: { id: entry.id },
									})
								}
								accessibilityRole="button"
								accessibilityLabel={`Open diary entry: ${entry.title}`}
								className="rounded-2xl border border-border bg-surface px-4 py-4"
							>
								<View className="flex-row items-center">
									<View className="flex-1 pr-3">
										<Text className="font-sans-medium text-base text-foreground">
											{entry.title}
										</Text>
										<Text className="mt-1 font-sans text-xs text-muted">
											{formatEntryDate(entry.created_at)}
										</Text>
									</View>
									<StyledChevronRightIcon className="text-muted" size={20} />
								</View>
							</Pressable>
						))}
					</View>
				)}
			</ScrollView>
		</StyledSafeAreaView>
	);
}
