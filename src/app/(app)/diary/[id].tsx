import { useLocalSearchParams, useRouter } from "expo-router";
import { Spinner } from "heroui-native/spinner";
import { ArrowLeftIcon, BookHeartIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { api } from "@/lib/api";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledArrowLeftIcon = withUniwind(ArrowLeftIcon);
const StyledBookHeartIcon = withUniwind(BookHeartIcon);

type DiaryEntry = {
	id: string;
	title: string;
	content: string;
	created_at: string;
};

function formatEntryDate(dateString: string) {
	const date = new Date(
		/(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateString) ? dateString : `${dateString}Z`,
	);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

export default function DiaryEntryScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const [entry, setEntry] = useState<DiaryEntry | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		api
			.get<DiaryEntry[]>("/api/diary", { params: { limit: 100 } })
			.then((response) => {
				if (!cancelled) {
					const foundEntry = response.data.find((item) => item.id === id);
					setEntry(foundEntry ?? null);
					if (!foundEntry) setError("This diary entry could not be found.");
				}
			})
			.catch(() => {
				if (!cancelled)
					setError("We couldn't load this diary entry. Please try again.");
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [id]);

	return (
		<StyledSafeAreaView edges={["top"]} className="flex-1 bg-background">
			<View className="flex-row items-center border-b border-border px-5 py-3">
				<Pressable
					onPress={() => router.back()}
					accessibilityRole="button"
					accessibilityLabel="Go back to diary"
					className="size-10 items-center justify-center"
				>
					<StyledArrowLeftIcon className="text-foreground" size={21} />
				</Pressable>
				<Text className="flex-1 text-center font-sans-medium text-base text-foreground">
					Diary entry
				</Text>
				<View className="size-10" />
			</View>

			{isLoading ? (
				<View className="flex-1 items-center justify-center">
					<Spinner size="lg" />
				</View>
			) : error || !entry ? (
				<View className="flex-1 items-center justify-center px-8">
					<Text className="text-center font-sans text-muted">{error}</Text>
				</View>
			) : (
				<ScrollView contentContainerClassName="px-6 py-7 pb-12">
					<View className="size-12 items-center justify-center rounded-full bg-accent/10">
						<StyledBookHeartIcon className="text-accent" size={24} />
					</View>
					<Text className="mt-5 font-serif text-3xl text-foreground">
						{entry.title}
					</Text>
					<Text className="mt-2 font-sans text-sm text-muted">
						{formatEntryDate(entry.created_at)}
					</Text>
					<View className="mt-7 rounded-3xl border border-border bg-surface px-5 py-6">
						<Text className="font-sans text-base leading-7 text-foreground">
							{entry.content}
						</Text>
					</View>
				</ScrollView>
			)}
		</StyledSafeAreaView>
	);
}
