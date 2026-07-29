import { useFocusEffect, useRouter } from "expo-router";
import { BottomSheet } from "heroui-native/bottom-sheet";
import {
	ChevronRightIcon,
	MessageCircleIcon,
	PlusIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	RefreshControl,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { api } from "@/lib/api";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledChevronRightIcon = withUniwind(ChevronRightIcon);
const StyledMessageCircleIcon = withUniwind(MessageCircleIcon);
const StyledPlusIcon = withUniwind(PlusIcon);
const StyledRefreshCwIcon = withUniwind(RefreshCwIcon);
const StyledTrash2Icon = withUniwind(Trash2Icon);

type Conversation = {
	created_at: string;
	id: string;
	title: string;
	updated_at: string;
	user_id: string;
};

function formatUpdatedAt(dateString: string) {
	// Session timestamps are returned in UTC without a timezone suffix.
	const utcDateString = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateString)
		? dateString
		: `${dateString}Z`;
	const date = new Date(utcDateString);
	if (Number.isNaN(date.getTime())) return "";

	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const startOfDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
	const daysAgo = Math.round(
		(startOfToday.getTime() - startOfDate.getTime()) / 86_400_000,
	);

	if (daysAgo === 0)
		return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	if (daysAgo === 1) return "Yesterday";
	if (daysAgo < 7) return date.toLocaleDateString([], { weekday: "short" });
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function getConversations() {
	const response = await api.get<Conversation[]>("/api/sessions");
	return response.data;
}

export default function ChatsScreen() {
	const router = useRouter();
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedConversation, setSelectedConversation] =
		useState<Conversation | null>(null);
	const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const loadConversations = async (refresh = false) => {
		if (refresh) setIsRefreshing(true);
		setError(null);

		try {
			setConversations(await getConversations());
		} catch {
			setError("We couldn't load your conversations. Please try again.");
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	};

	useFocusEffect(
		useCallback(() => {
			let cancelled = false;

			getConversations()
				.then((data) => {
					if (!cancelled) setConversations(data);
				})
				.catch(() => {
					if (!cancelled)
						setError("We couldn't load your conversations. Please try again.");
				})
				.finally(() => {
					if (!cancelled) setIsLoading(false);
				});

			return () => {
				cancelled = true;
			};
		}, []),
	);

	const deleteConversation = async () => {
		if (!selectedConversation) return;

		setIsDeleting(true);
		try {
			await api.delete(`/api/sessions/${selectedConversation.id}`);
			setConversations((current) =>
				current.filter(
					(conversation) => conversation.id !== selectedConversation.id,
				),
			);
			setIsActionSheetOpen(false);
			setSelectedConversation(null);
		} catch {
			Alert.alert(
				"Unable to delete conversation",
				"Please check your connection and try again.",
			);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<StyledSafeAreaView className="flex-1 bg-background">
				<View className="flex-row items-center justify-between px-6 pt-4 pb-5">
					<View>
						<Text className="font-sans-medium text-3xl text-foreground">
							Conversations
						</Text>
						<Text className="mt-1 font-sans text-sm text-muted">
							A space to talk things through
						</Text>
					</View>
					<Pressable
						onPress={() => router.push("/chat/new")}
						accessibilityRole="button"
						accessibilityLabel="Start a new conversation"
						className="size-12 items-center justify-center rounded-full bg-accent"
					>
						<StyledPlusIcon className="text-accent-foreground" size={22} />
					</Pressable>
				</View>

				{isLoading ? (
					<View className="flex-1 items-center justify-center gap-3">
						<ActivityIndicator />
						<Text className="font-sans text-muted">
							Loading conversations...
						</Text>
					</View>
				) : error ? (
					<View className="flex-1 items-center justify-center px-8">
						<Text className="text-center font-sans text-muted">{error}</Text>
						<Pressable
							onPress={() => {
								setIsLoading(true);
								loadConversations();
							}}
							accessibilityRole="button"
							className="mt-5 flex-row items-center gap-2 rounded-full border border-border px-5 py-3"
						>
							<StyledRefreshCwIcon className="text-foreground" size={16} />
							<Text className="font-sans-medium text-foreground">
								Try again
							</Text>
						</Pressable>
					</View>
				) : (
					<FlatList
						data={conversations}
						keyExtractor={(conversation) => conversation.id}
						contentContainerClassName="px-5 pb-8"
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								onRefresh={() => loadConversations(true)}
							/>
						}
						renderItem={({ item }) => (
							<Pressable
								onPress={() =>
									router.push({
										pathname: "/chat/[id]",
										params: { id: item.id, chatTitle: item.title },
									})
								}
								onLongPress={() => {
									setSelectedConversation(item);
									setIsActionSheetOpen(true);
								}}
								accessibilityRole="button"
								accessibilityLabel={`Open conversation: ${item.title}`}
								className="mb-3 flex-row items-center rounded-2xl border border-border bg-surface px-4 py-4"
							>
								<View className="mr-3 size-11 items-center justify-center rounded-full bg-accent/10">
									<StyledMessageCircleIcon className="text-accent" size={20} />
								</View>
								<View className="flex-1 pr-3">
									<Text
										numberOfLines={1}
										className="font-sans-medium text-base text-foreground"
									>
										{item.title || "Untitled conversation"}
									</Text>
									<Text className="mt-1 font-sans text-sm text-muted">
										{formatUpdatedAt(item.updated_at)}
									</Text>
								</View>
								<StyledChevronRightIcon className="text-muted" size={20} />
							</Pressable>
						)}
						ListEmptyComponent={
							<View className="items-center px-8 pt-28">
								<View className="size-16 items-center justify-center rounded-full bg-surface">
									<StyledMessageCircleIcon className="text-muted" size={28} />
								</View>
								<Text className="mt-5 font-sans-medium text-lg text-foreground">
									No conversations yet
								</Text>
								<Text className="mt-2 text-center font-sans text-muted">
									Start a chat whenever you need a little support.
								</Text>
							</View>
						}
					/>
				)}
			</StyledSafeAreaView>
			<BottomSheet
				isOpen={isActionSheetOpen}
				onOpenChange={(isOpen) => {
					setIsActionSheetOpen(isOpen);
					if (!isOpen && !isDeleting) setSelectedConversation(null);
				}}
			>
				<BottomSheet.Portal>
					<BottomSheet.Overlay />
					<BottomSheet.Content>
						<View className="px-5 pb-7 pt-2">
							<BottomSheet.Title className="font-sans-medium text-lg text-foreground">
								Conversation options
							</BottomSheet.Title>
							<BottomSheet.Description className="mt-1 font-sans text-sm text-muted">
								{selectedConversation?.title || "Untitled conversation"}
							</BottomSheet.Description>
							<Pressable
								onPress={() =>
									Alert.alert(
										"Delete conversation?",
										"This will permanently remove this conversation and its messages.",
										[
											{ text: "Cancel", style: "cancel" },
											{
												text: "Delete",
												style: "destructive",
												onPress: deleteConversation,
											},
										],
									)
								}
								disabled={isDeleting}
								accessibilityRole="button"
								className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-red-500/10 py-4 disabled:opacity-50"
							>
								{isDeleting ? (
									<ActivityIndicator />
								) : (
									<StyledTrash2Icon className="text-red-600" size={19} />
								)}
								<Text className="font-sans-medium text-red-600">
									Delete conversation
								</Text>
							</Pressable>
						</View>
					</BottomSheet.Content>
				</BottomSheet.Portal>
			</BottomSheet>
		</>
	);
}
