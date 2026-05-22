import type { ListingSummary } from "@proppy/shared/types";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  bedroomsForFlatType,
  formatListingPrice
} from "../lib/listing-format";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='100%25' height='100%25' fill='%23ccfbf1'/%3E%3C/svg%3E";

type ListingCardProps = {
  listing: ListingSummary;
  onPress: (id: string) => void;
};

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const [photo] = listing.photos;
  const imageLabel = photo?.alt || listing.title;

  return (
    <Pressable
      accessibilityLabel={`View ${listing.title}`}
      accessibilityRole="link"
      onPress={() => onPress(listing.id)}
      style={styles.card}
      testID="listing-card"
    >
      <Image
        accessibilityLabel={imageLabel}
        alt={imageLabel}
        resizeMode="cover"
        source={{ uri: photo?.url ?? PLACEHOLDER_IMAGE }}
        style={styles.image}
      />
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
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Flat type</Text>
            <Text style={styles.metaValue}>{listing.flat_type}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Bedrooms</Text>
            <Text style={styles.metaValue}>
              {bedroomsForFlatType(listing.flat_type)}
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
  image: {
    backgroundColor: "#ccfbf1",
    height: 190,
    width: "100%"
  },
  content: {
    gap: 14,
    minHeight: 220,
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
  metaGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: "auto"
  },
  metaItem: {
    flex: 1,
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
