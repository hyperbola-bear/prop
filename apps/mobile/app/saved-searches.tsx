import type { SavedSearch } from "@proppy/shared/types";
import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthNav } from "../components/AuthNav";
import { mobileApiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import {
  describeSavedQuery,
  paramsFromSavedQuery,
  type SavedSearchQuery
} from "../lib/search-options";

export default function SavedSearchesScreen() {
  const router = useRouter();
  const { isHydrating, token } = useAuth();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isHydrating) {
      return;
    }
    if (!token) {
      router.replace("/login" as Href);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    mobileApiClient.savedSearches
      .list()
      .then(({ items }) => {
        if (isMounted) {
          setSavedSearches(items);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isMounted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load saved searches right now."
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isHydrating, router, token]);

  async function updateNotifyEmail(id: string, notifyEmail: boolean) {
    if (!token) {
      router.replace("/login" as Href);
      return;
    }

    setSavedSearches((current) =>
      current.map((savedSearch) =>
        savedSearch.id === id
          ? { ...savedSearch, notify_email: notifyEmail }
          : savedSearch
      )
    );

    try {
      await mobileApiClient.savedSearches.update(id, {
        notify_email: notifyEmail
      });
    } catch {
      setSavedSearches((current) =>
        current.map((savedSearch) =>
          savedSearch.id === id
            ? { ...savedSearch, notify_email: !notifyEmail }
            : savedSearch
        )
      );
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <AuthNav />
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>Alerts and saved filters</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Saved searches
        </Text>
        <Text style={styles.body}>
          Reopen your filters and choose whether matching new listings should
          email you.
        </Text>
      </View>

      {isLoading || isHydrating ? (
        <Text style={styles.status}>Loading saved searches…</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isLoading && !error && savedSearches.length === 0 ? (
        <Text style={styles.empty}>No results</Text>
      ) : null}

      <View accessibilityLabel="Saved searches" style={styles.list}>
        {savedSearches.map((savedSearch) => {
          const query = savedSearch.query as SavedSearchQuery;
          const params = paramsFromSavedQuery(query);
          return (
            <View key={savedSearch.id} style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{savedSearch.name}</Text>
                <Text style={styles.queryText}>{describeSavedQuery(query)}</Text>
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    router.push((params ? `/search?${params}` : "/search") as Href)
                  }
                >
                  <Text style={styles.link}>Open search</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityLabel="Notify by email"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: savedSearch.notify_email }}
                onPress={() =>
                  void updateNotifyEmail(
                    savedSearch.id,
                    !savedSearch.notify_email
                  )
                }
                style={styles.notifyRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    savedSearch.notify_email ? styles.checkboxBoxChecked : null
                  ]}
                >
                  {savedSearch.notify_email ? (
                    <Text style={styles.checkboxTick}>✓</Text>
                  ) : null}
                </View>
                <Text style={styles.notifyText}>Notify by email</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#334155",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10
  },
  brand: {
    color: "#0f766e",
    fontSize: 22,
    fontWeight: "800"
  },
  card: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
    padding: 18
  },
  cardBody: {
    flexBasis: 320,
    flexGrow: 1,
    gap: 8
  },
  cardTitle: {
    color: "#020617",
    fontSize: 18,
    fontWeight: "800"
  },
  checkboxBox: {
    alignItems: "center",
    borderColor: "#cbd5e1",
    borderRadius: 4,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  checkboxBoxChecked: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  checkboxTick: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  container: {
    backgroundColor: "#f8fafc",
    gap: 28,
    minHeight: "100%",
    padding: 24
  },
  empty: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    color: "#334155",
    fontSize: 18,
    fontWeight: "700",
    padding: 32,
    textAlign: "center"
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
  hero: {
    maxWidth: 760
  },
  kicker: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  link: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800"
  },
  list: {
    gap: 16
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  notifyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  notifyText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  },
  queryText: {
    color: "#64748b",
    fontSize: 14
  },
  status: {
    color: "#475569",
    fontSize: 16
  },
  title: {
    color: "#020617",
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 44
  }
});
