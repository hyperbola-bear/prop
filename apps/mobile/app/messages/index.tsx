import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthNav } from "../../components/AuthNav";
import { mobileApiClient } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { formatUnreadBadge, totalUnreadCount } from "../../lib/messaging";

export default function MessagesIndexScreen() {
  const router = useRouter();
  const { isHydrating, token } = useAuth();
  const conversationsQuery = useQuery({
    enabled: Boolean(token),
    queryFn: () => mobileApiClient.conversations.list(),
    queryKey: ["conversations"],
    refetchInterval: 5000
  });

  useEffect(() => {
    if (!isHydrating && !token) {
      router.replace("/login" as Href);
    }
  }, [isHydrating, router, token]);

  const conversations = conversationsQuery.data?.items ?? [];
  const unreadBadge = formatUnreadBadge(totalUnreadCount(conversations));

  if (isHydrating || (!token && !conversationsQuery.isError)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Loading messages…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <AuthNav />
      </View>

      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Messages
        </Text>
        <Text style={styles.subtitle}>
          Your property enquiries and owner conversations update every 5 seconds.
        </Text>
        {unreadBadge ? (
          <Text accessibilityLabel={`${unreadBadge} unread messages`} style={styles.headerBadge}>
            {unreadBadge} unread
          </Text>
        ) : null}
      </View>

      {conversationsQuery.isLoading ? (
        <Text style={styles.status}>Loading conversations…</Text>
      ) : null}
      {conversationsQuery.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Unable to load conversations.
        </Text>
      ) : null}

      {!conversationsQuery.isLoading && conversations.length === 0 ? (
        <Text style={styles.empty}>
          No conversations yet. Send an enquiry from a listing to get started.
        </Text>
      ) : null}

      <View style={styles.list}>
        {conversations.map((conversation) => (
          <Pressable
            accessibilityRole="button"
            key={conversation.id}
            onPress={() => router.push(`/messages/${conversation.id}` as Href)}
            style={styles.card}
          >
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Conversation about listing</Text>
              <Text style={styles.cardMeta}>Listing ID: {conversation.listingId}</Text>
              {conversation.last_message_at ? (
                <Text style={styles.cardMeta}>
                  Last message:{" "}
                  {new Date(conversation.last_message_at).toLocaleString("en-SG")}
                </Text>
              ) : null}
            </View>
            {conversation.unread_count > 0 ? (
              <Text style={styles.unreadPill}>{conversation.unread_count} unread</Text>
            ) : (
              <Text style={styles.readPill}>Read</Text>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: "#0f766e",
    fontSize: 22,
    fontWeight: "800"
  },
  card: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
    padding: 20
  },
  cardCopy: {
    flexBasis: 300,
    flexGrow: 1,
    gap: 6
  },
  cardMeta: {
    color: "#64748b",
    fontSize: 13
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800"
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  container: {
    backgroundColor: "#f8fafc",
    gap: 28,
    minHeight: "100%",
    padding: 24
  },
  empty: {
    borderColor: "#cbd5e1",
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    color: "#64748b",
    fontSize: 16,
    padding: 24
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
  header: {
    gap: 10,
    maxWidth: 760
  },
  headerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e11d48",
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  list: {
    gap: 14
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between"
  },
  readPill: {
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  status: {
    color: "#475569",
    fontSize: 16
  },
  subtitle: {
    color: "#475569",
    fontSize: 17,
    lineHeight: 26
  },
  title: {
    color: "#0f172a",
    fontSize: 36,
    fontWeight: "800"
  },
  unreadPill: {
    backgroundColor: "#e11d48",
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6
  }
});
