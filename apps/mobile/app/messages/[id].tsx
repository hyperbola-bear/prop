import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { mobileApiClient } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  jwtSubject,
  messageSenderLabel,
  shouldShowScamWarning
} from "../../lib/messaging";
import { ReportDialog } from "../../components/report/ReportDialog";

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isHydrating, token } = useAuth();
  const currentUserId = useMemo(() => jwtSubject(token), [token]);
  const conversationId = useMemo(() => {
    if (Array.isArray(params.id)) {
      return params.id[0];
    }

    return params.id;
  }, [params.id]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!isHydrating && !token) {
      router.replace("/login" as Href);
    }
  }, [isHydrating, router, token]);

  const conversationQuery = useQuery({
    enabled: Boolean(token && conversationId),
    queryFn: () => mobileApiClient.conversations.get(conversationId ?? ""),
    queryKey: ["conversation", conversationId],
    refetchInterval: 5000
  });

  const sendMutation = useMutation({
    mutationFn: (messageBody: string) =>
      mobileApiClient.conversations.sendMessage(conversationId ?? "", {
        body: messageBody
      }),
    onError: () => {
      sendingRef.current = false;
      setError("Unable to send message. Please try again.");
    },
    onSuccess: async () => {
      sendingRef.current = false;
      setBody("");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["me", "unread-count"] });
    }
  });

  useEffect(() => {
    if (!conversationQuery.data || !conversationId) {
      return;
    }

    void mobileApiClient.conversations.markRead(conversationId).then(async () => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["me", "unread-count"] });
    });
  }, [conversationId, conversationQuery.data?.last_message_at, queryClient]);

  function submitMessage() {
    const webBody =
      Platform.OS === "web"
        ? (globalThis.document?.querySelector(
            '[data-testid="chat-input"]'
          ) as HTMLTextAreaElement | null)?.value
        : null;
    const trimmed = (webBody ?? body).trim();
    if (!trimmed || sendingRef.current || !conversationId) {
      return;
    }

    sendingRef.current = true;
    sendMutation.mutate(trimmed);
  }

  if (isHydrating || (!token && !conversationQuery.isError)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Loading conversation…</Text>
      </View>
    );
  }

  if (!conversationId) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.error}>
          Conversation not found.
        </Text>
      </View>
    );
  }

  if (conversationQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Loading conversation…</Text>
      </View>
    );
  }

  if (conversationQuery.isError || !conversationQuery.data) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.error}>
          Unable to load this conversation.
        </Text>
      </View>
    );
  }

  const conversation = conversationQuery.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/messages" as Href)}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Messages</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Conversation
        </Text>
        <Text style={styles.subtitle}>Listing ID: {conversation.listingId}</Text>
      </View>

      <View style={styles.thread} testID="chat-thread">
        {conversation.messages.map((message) => {
          const mine = message.senderUserId === currentUserId;

          return (
            <View
              key={message.id}
              style={[styles.messageRow, mine ? styles.messageRowMine : null]}
              testID="chat-message"
            >
              <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : null]}>
                {shouldShowScamWarning(message.scam_score) ? (
                  <Text
                    accessibilityRole="alert"
                    style={styles.scamWarning}
                    testID="chat-scam-warning"
                  >
                    Caution: this message contains suspicious patterns.
                  </Text>
                ) : null}
                <Text style={[styles.messageBody, mine ? styles.messageBodyMine : null]}>
                  {message.body}
                </Text>
                <View style={styles.messageMeta}>
                  <Text style={[styles.messageMetaText, mine ? styles.messageMetaMine : null]}>
                    {messageSenderLabel(message, currentUserId)}
                  </Text>
                  {message.created_at ? (
                    <Text style={[styles.messageMetaText, mine ? styles.messageMetaMine : null]}>
                      {new Date(message.created_at).toLocaleString("en-SG")}
                    </Text>
                  ) : null}
                  <ReportDialog
                    buttonLabel="Report"
                    buttonTestID="report-button"
                    targetId={message.id}
                    targetType="message"
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.composer}>
        <Text nativeID="chat-input-label" style={styles.label}>
          Message
        </Text>
        {Platform.OS === "web" ? (
          createElement("textarea", {
            "aria-labelledby": "chat-input-label",
            "data-testid": "chat-input",
            onChange: (event) =>
              setBody((event.currentTarget as HTMLTextAreaElement).value),
            placeholder: "Write your reply",
            rows: 4,
            style: webStyles.textArea,
            value: body
          })
        ) : (
          <TextInput
            accessibilityLabelledBy="chat-input-label"
            multiline
            onChangeText={setBody}
            placeholder="Write your reply"
            style={styles.input}
            testID="chat-input"
            value={body}
          />
        )}
        {error ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        <View style={styles.composerActions}>
          {Platform.OS === "web" ? (
            createElement(
              "button",
              {
                "data-testid": "chat-send",
                onClick: submitMessage,
                style: {
                  ...webStyles.sendButton,
                  ...(sendMutation.isPending || !body.trim()
                    ? webStyles.disabledButton
                    : {})
                },
                type: "button"
              },
              sendMutation.isPending ? "Sending…" : "Send"
            )
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={submitMessage}
              style={[
                styles.sendButton,
                sendMutation.isPending || !body.trim() ? styles.disabledButton : null
              ]}
              testID="chat-send"
            >
              <Text style={styles.sendButtonText}>
                {sendMutation.isPending ? "Sending…" : "Send"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  backButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  composer: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  composerActions: {
    alignItems: "flex-end"
  },
  container: {
    backgroundColor: "#f8fafc",
    gap: 24,
    minHeight: "100%",
    padding: 24
  },
  disabledButton: {
    opacity: 0.6
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 16,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 16,
    padding: 16
  },
  errorText: {
    color: "#be123c",
    fontSize: 14
  },
  header: {
    gap: 8
  },
  input: {
    borderColor: "#cbd5e1",
    borderRadius: 16,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top"
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800"
  },
  messageBody: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 24
  },
  messageBodyMine: {
    color: "#ffffff"
  },
  messageBubble: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    maxWidth: "78%",
    padding: 14
  },
  messageBubbleMine: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  messageMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  messageMetaMine: {
    color: "#ccfbf1"
  },
  messageMetaText: {
    color: "#64748b",
    fontSize: 12
  },
  messageRow: {
    alignItems: "flex-start"
  },
  messageRowMine: {
    alignItems: "flex-end"
  },
  scamWarning: {
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
    borderRadius: 14,
    borderWidth: 1,
    color: "#92400e",
    fontSize: 13,
    fontWeight: "800",
    padding: 10
  },
  sendButton: {
    backgroundColor: "#0f766e",
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  status: {
    color: "#475569",
    fontSize: 16
  },
  subtitle: {
    color: "#64748b",
    fontSize: 15
  },
  thread: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  title: {
    color: "#0f172a",
    fontSize: 34,
    fontWeight: "800"
  }
});

const webStyles = {
  disabledButton: {
    opacity: 0.6
  },
  sendButton: {
    backgroundColor: "#0f766e",
    border: "0",
    borderRadius: 999,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
    padding: "12px 24px"
  },
  textArea: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    boxSizing: "border-box",
    color: "#0f172a",
    fontFamily: "inherit",
    fontSize: 16,
    minHeight: 110,
    padding: "12px 14px",
    resize: "vertical",
    width: "100%"
  }
} as const;
