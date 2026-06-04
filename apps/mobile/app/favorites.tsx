import type { ListingSummary } from "@proppy/shared/types";
import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthNav } from "../components/AuthNav";
import { ListingCard } from "../components/ListingCard";
import { mobileApiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function FavoritesScreen() {
  const router = useRouter();
  const { isHydrating, token } = useAuth();
  const [listings, setListings] = useState<ListingSummary[]>([]);
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
    mobileApiClient.me
      .favorites()
      .then(({ items }) => {
        if (isMounted) {
          setListings(items);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isMounted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load favorites right now."
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

  function openListing(id: string) {
    router.push(`/listings/${id}` as Href);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <AuthNav />
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>Pinned rentals</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Favorites
        </Text>
        <Text style={styles.body}>
          Your favorited listings are saved here for quick comparison.
        </Text>
      </View>

      {isLoading || isHydrating ? (
        <Text style={styles.status}>Loading favorites…</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isLoading && !error && listings.length === 0 ? (
        <Text style={styles.empty}>No results</Text>
      ) : null}

      <View accessibilityLabel="Favorite listings" style={styles.grid}>
        {listings.map((listing) => (
          <ListingCard
            initialFavorited
            key={listing.id}
            listing={listing}
            onPress={openListing}
          />
        ))}
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20
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
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
