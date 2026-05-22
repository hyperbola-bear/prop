import type { ListingSummary } from "@proppy/shared/types";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ListingCard } from "../components/ListingCard";
import { mobileApiClient } from "../lib/api";

export default function HomeScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    mobileApiClient.listings
      .list({ limit: 20 })
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
              : "Unable to load listings right now."
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
  }, []);

  function openListing(id: string) {
    router.push(`/listings/${id}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => undefined}
          style={styles.signInButton}
          testID="nav-signin"
        >
          <Text style={styles.signInText}>Sign in</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>Singapore HDB rentals</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Browse rentals in Singapore
        </Text>
        <Text style={styles.body}>
          Discover verified HDB rental homes across Singapore towns with clear
          prices, photos, flat details, and lease terms.
        </Text>
      </View>

      {isLoading ? <Text style={styles.status}>Loading listings…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View accessibilityLabel="Rental listings" style={styles.grid}>
        {listings.map((listing) => (
          <ListingCard
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
  container: {
    gap: 32,
    minHeight: "100%",
    padding: 24,
    backgroundColor: "#f8fafc"
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  brand: {
    color: "#0f766e",
    fontSize: 22,
    fontWeight: "800"
  },
  signInButton: {
    borderColor: "#0f766e",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  signInText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "700"
  },
  hero: {
    maxWidth: 760
  },
  kicker: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: "#111827",
    fontSize: 36,
    fontWeight: "700"
  },
  body: {
    color: "#334155",
    fontSize: 18,
    lineHeight: 28,
    marginTop: 16
  },
  status: {
    color: "#475569",
    fontSize: 16
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
    gap: 24
  }
});
