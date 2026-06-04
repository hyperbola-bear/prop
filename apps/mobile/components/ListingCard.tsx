import type { ListingSummary } from "@proppy/shared/types";
import { useRouter, type Href } from "expo-router";
import { useState, type ComponentProps } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  bedroomsForFlatType,
  formatAvailableDate,
  formatListingPrice
} from "../lib/listing-format";
import { mobileApiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='100%25' height='100%25' fill='%23ccfbf1'/%3E%3C/svg%3E";

type ListingCardProps = {
  initialFavorited?: boolean;
  listing: ListingSummary;
  onPress: (id: string) => void;
};

export function ListingCard({
  initialFavorited = false,
  listing,
  onPress
}: ListingCardProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [photo] = listing.photos;
  const bedrooms = listing.bedrooms
    ? `${listing.bedrooms} bedrooms`
    : bedroomsForFlatType(listing.flat_type);
  const imageLabel = photo?.alt || listing.title;

  async function toggleFavorite() {
    if (!token) {
      router.push("/login" as Href);
      return;
    }

    const nextFavorited = !isFavorited;
    setIsFavorited(nextFavorited);
    setIsTogglingFavorite(true);
    try {
      if (nextFavorited) {
        await mobileApiClient.listings.favorite(listing.id);
      } else {
        await mobileApiClient.listings.unfavorite(listing.id);
      }
    } catch {
      setIsFavorited(!nextFavorited);
    } finally {
      setIsTogglingFavorite(false);
    }
  }

  return (
    <Pressable
      {...({ "data-published-at": listing.published_at ?? "" } as ComponentProps<
        typeof Pressable
      >)}
      {...({ "data-listing-id": listing.id } as ComponentProps<typeof Pressable>)}
      {...({ href: `/listings/${listing.id}` } as ComponentProps<typeof Pressable>)}
      accessibilityLabel={`View ${listing.title}`}
      accessibilityRole="link"
      onPress={() => onPress(listing.id)}
      style={styles.card}
      testID="listing-card"
    >
      <View style={styles.imageWrap}>
        <Image
          accessibilityLabel={imageLabel}
          alt={imageLabel}
          resizeMode="cover"
          source={{ uri: photo?.url ?? PLACEHOLDER_IMAGE }}
          style={styles.image}
        />
        <Pressable
          {...({ "aria-pressed": isFavorited } as ComponentProps<typeof Pressable>)}
          accessibilityLabel={
            isFavorited ? "Remove from favorites" : "Add to favorites"
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: isTogglingFavorite, selected: isFavorited }}
          disabled={isTogglingFavorite}
          onPress={(event) => {
            event.stopPropagation();
            void toggleFavorite();
          }}
          style={[
            styles.favoriteButton,
            isFavorited ? styles.favoriteButtonActive : null
          ]}
          testID="favorite-toggle"
        >
          <Text
            style={[
              styles.favoriteText,
              isFavorited ? styles.favoriteTextActive : null
            ]}
          >
            {isFavorited ? "♥" : "♡"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        <View style={styles.headingRow}>
          <Text numberOfLines={2} style={styles.title}>
            {listing.title}
          </Text>
          <Text style={styles.price} testID="listing-price">
            {formatListingPrice(listing.price_sgd)}
          </Text>
        </View>
        <Text style={styles.town}>{listing.address.town}</Text>
        <Text numberOfLines={2} style={styles.description}>
          {listing.description ?? "Singapore HDB rental listing"}
        </Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Flat type</Text>
            <Text style={styles.metaValue}>{listing.flat_type}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Bedrooms</Text>
            <Text style={styles.metaValue}>{bedrooms}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Lease</Text>
            <Text style={styles.metaValue}>{listing.lease_months} months</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Available</Text>
            <Text style={styles.metaValue}>
              {formatAvailableDate(listing.available_from)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Furnishing</Text>
            <Text style={styles.metaValue}>
              {listing.furnishing === "Fully"
                ? "Fully furnished"
                : listing.furnishing ?? "Flexible"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Room type</Text>
            <Text style={styles.metaValue}>
              {listing.room_only ? "Room-only" : "Whole unit"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
    flexBasis: 300,
    flexGrow: 1,
    maxWidth: 380,
    minWidth: 280,
    overflow: "hidden"
  },
  imageWrap: {
    position: "relative"
  },
  image: {
    backgroundColor: "#ccfbf1",
    height: 190,
    width: "100%"
  },
  favoriteButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.18)",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 44
  },
  favoriteButtonActive: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3"
  },
  favoriteText: {
    color: "#475569",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28
  },
  favoriteTextActive: {
    color: "#e11d48"
  },
  content: {
    gap: 14,
    minHeight: 280,
    padding: 20
  },
  headingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  title: {
    color: "#020617",
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24
  },
  price: {
    backgroundColor: "#f0fdfa",
    borderRadius: 999,
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  town: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8
  },
  description: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: "auto"
  },
  metaItem: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: 4
  },
  metaLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  metaValue: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  }
});
