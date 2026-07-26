import { useRouter } from "expo-router";
import { Button } from "heroui-native/button";
import { Input } from "heroui-native/input";
import {
	ArrowLeftIcon,
	ArrowUpIcon,
	AudioLinesIcon,
	SparklesIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { useAuth } from "@/context/AuthContext";
import { api, createChatWebSocketUrl } from "@/lib/api";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledArrowLeftIcon = withUniwind(ArrowLeftIcon);
const StyledArrowUpIcon = withUniwind(ArrowUpIcon);
const StyledSparklesIcon = withUniwind(SparklesIcon);
const StyledAudioLines = withUniwind(AudioLinesIcon);

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type HistoryMessage = {
	id: string;
	role: "user" | "ai" | "assistant";
	content: string;
};
type ChatSocketEvent = {
	layer:
		| "session_id"
		| "immediate"
		| "rag"
		| "emergency"
		| "irrelevant"
		| "transcript"
		| "audio";
	content?: string;
	final?: boolean;
};

function createLocalId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ChatScreen({
	initialSessionId,
}: {
	initialSessionId?: string;
}) {
	const router = useRouter();
	const { session } = useAuth();
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [isLoadingHistory, setIsLoadingHistory] = useState(
		Boolean(initialSessionId),
	);
	const [isConnecting, setIsConnecting] = useState(true);
	const [isResponding, setIsResponding] = useState(false);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [statusText, setStatusText] = useState<string | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const activeSessionIdRef = useRef(initialSessionId);
	const activeAssistantMessageIdRef = useRef<string | null>(null);
	const listRef = useRef<FlatList<ChatMessage>>(null);

	const appendAssistantText = useCallback((content: string) => {
		if (!content) return;
		setMessages((current) => {
			const activeId = activeAssistantMessageIdRef.current;
			if (activeId)
				return current.map((message) =>
					message.id === activeId
						? { ...message, content: message.content + content }
						: message,
				);
			const id = createLocalId();
			activeAssistantMessageIdRef.current = id;
			return [...current, { id, role: "assistant", content }];
		});
	}, []);

	useEffect(() => {
		if (!session) return;
		const connectionUrl = createChatWebSocketUrl(session);
		const socket = new WebSocket(connectionUrl);
		socketRef.current = socket;
		socket.onopen = () => setIsConnecting(false);
		socket.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as ChatSocketEvent;
				if (message.layer === "session_id" && message.content)
					activeSessionIdRef.current = message.content;
				if (message.layer === "immediate")
					setStatusText(message.content ?? "Thinking...");
				if (message.layer === "rag") {
					setStatusText(null);
					appendAssistantText(message.content ?? "");
				}
				if (message.layer === "emergency" || message.layer === "irrelevant") {
					setStatusText(null);
					appendAssistantText(message.content ?? "");
				}
				if (message.final) {
					activeAssistantMessageIdRef.current = null;
					setIsResponding(false);
					setStatusText(null);
				}
			} catch {
				setConnectionError(
					"The chat service sent an invalid response. Please try again.",
				);
				setIsResponding(false);
			}
		};
		socket.onerror = () => {
			setConnectionError(
				"Couldn't connect to Dear AI. Check your connection and try again.",
			);
			setIsConnecting(false);
			setIsResponding(false);
		};
		socket.onclose = () => {
			if (socketRef.current === socket) setIsConnecting(false);
		};
		return () => {
			socket.close();
			if (socketRef.current === socket) socketRef.current = null;
		};
	}, [appendAssistantText, session]);

	useEffect(() => {
		if (!initialSessionId) return;
		let cancelled = false;
		api
			.get<HistoryMessage[]>("/api/chat/chats", {
				params: { session_id: initialSessionId, limit: 100 },
			})
			.then((response) => {
				if (!cancelled)
					setMessages(
						response.data.map((message) => ({
							id: message.id,
							role: message.role === "user" ? "user" : "assistant",
							content: message.content,
						})),
					);
			})
			.catch(() => {
				if (!cancelled) setConnectionError("Unable to load this conversation.");
			})
			.finally(() => {
				if (!cancelled) setIsLoadingHistory(false);
			});
		return () => {
			cancelled = true;
		};
	}, [initialSessionId]);

	const sendMessage = useCallback(() => {
		const content = draft.trim();
		const socket = socketRef.current;
		if (
			!content ||
			!socket ||
			socket.readyState !== WebSocket.OPEN ||
			isResponding
		)
			return;
		activeAssistantMessageIdRef.current = null;
		setMessages((current) => [
			...current,
			{ id: createLocalId(), role: "user", content },
		]);
		setDraft("");
		setIsResponding(true);
		setStatusText("Thinking...");
		socket.send(
			JSON.stringify({ content, session_id: activeSessionIdRef.current }),
		);
	}, [draft, isResponding]);

	const renderMessage = useCallback(
		({ item }: { item: ChatMessage }) => (
			<View
				className={`mb-3 ${item.role === "user" ? "items-end" : "items-start"}`}
			>
				<View
					className={`max-w-[86%] rounded-3xl px-4 py-3 ${item.role === "user" ? "bg-accent rounded-br-md" : "bg-surface border border-border rounded-bl-md"}`}
				>
					<Text
						className={
							item.role === "user"
								? "font-sans text-white leading-6"
								: "font-sans text-foreground leading-6"
						}
					>
						{item.content}
					</Text>
				</View>
			</View>
		),
		[],
	);

	return (
		<StyledSafeAreaView
			className="flex-1 bg-background"
			edges={["top", "bottom"]}
		>
			<View className="px-5 py-3 flex-row items-center border-b border-border">
				<Pressable
					onPress={() => router.back()}
					hitSlop={12}
					className="size-10 items-center justify-center"
				>
					<StyledArrowLeftIcon className="text-foreground size-5" />
				</Pressable>
				<View className="flex-1 items-center">
					<Text className="font-sans-medium text-base text-foreground">
						Dear AI
					</Text>
					<Text className="font-sans text-xs text-muted">
						Your private space to talk
					</Text>
				</View>
				<View className="size-10" />
			</View>
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={8}
			>
				{isLoadingHistory ? (
					<View className="flex-1 items-center justify-center">
						<ActivityIndicator />
					</View>
				) : (
					<FlatList
						ref={listRef}
						data={messages}
						renderItem={renderMessage}
						keyExtractor={(item) => item.id}
						contentContainerClassName="px-5 py-5 flex-grow"
						onContentSizeChange={() =>
							listRef.current?.scrollToEnd({ animated: true })
						}
						ListEmptyComponent={
							<View className="flex-1 justify-center items-center px-8">
								<View className="size-14 rounded-full bg-accent/10 items-center justify-center mb-4">
									<StyledSparklesIcon className="text-accent size-6" />
								</View>
								<Text className="text-xl font-sans-medium text-foreground text-center">
									I’m here with you.
								</Text>
								<Text className="mt-2 font-sans text-muted text-center leading-6">
									Share whatever is on your mind, at your own pace.
								</Text>
							</View>
						}
					/>
				)}
				{(isConnecting || isResponding || connectionError) && (
					<View className="px-5 pb-2">
						<Text
							className={`font-sans text-xs ${connectionError ? "text-danger" : "text-muted"}`}
						>
							{connectionError ??
								(isConnecting ? "Connecting…" : (statusText ?? "Thinking…"))}
						</Text>
					</View>
				)}
				<View className="border-t border-border px-5 pt-3 pb-2 flex-row items-end gap-3 bg-background">
					<Input
						className="flex-1 px-4 border border-border"
						multiline
						placeholder="Write what's on your mind..."
						value={draft}
						onChangeText={setDraft}
						submitBehavior="newline"
					/>
					<Button
						isIconOnly
						onPress={sendMessage}
						isDisabled={!draft.trim() || isConnecting || isResponding}
						className={`size-12 rounded-full ${!draft.trim() || isConnecting || isResponding ? "bg-muted/50" : "bg-accent"}`}
					>
						<StyledArrowUpIcon className="text-accent-foreground size-5" />
					</Button>
				</View>
			</KeyboardAvoidingView>
		</StyledSafeAreaView>
	);
}
