import type { ListingDetail } from "@proppy/shared/types";
import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { EnquiryButton } from "../../components/messaging/EnquiryButton";
import { ReportDialog } from "../../components/report/ReportDialog";
import { mobileApiClient } from "../../lib/api";
import {
  bedroomsForFlatType,
  formatAvailableDate,
  formatListingPrice
} from "../../lib/listing-format";

export default function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = useMemo(() => {
    if (Array.isArray(params.id)) {
      return params.id[0];
    }

    return params.id;
  }, [params.id]);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!listingId) {
      setError("Listing not found.");
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    mobileApiClient.listings
      .get(listingId)
      .then((item) => {
        if (isMounted) {
          setListing(item);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (isMounted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load this listing right now."
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
  }, [listingId]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Loading listing…</Text>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Listing not found."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerGrid}>
        <View style={styles.heading}>
          <Text style={styles.town}>{listing.address.town}</Text>
          <Text
            accessibilityRole="header"
            style={styles.title}
            testID="listing-title"
          >
            {listing.title}
          </Text>
          <Text style={styles.description}>{listing.description}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.price} testID="listing-price">
            {formatListingPrice(listing.price_sgd)}
          </Text>
          <Text style={styles.priceLabel}>Monthly rent</Text>
          <View style={styles.definitionList}>
            <DetailRow label="Flat type" testID="listing-flat-type">
              {listing.flat_type}
            </DetailRow>
            <DetailRow label="Bedrooms">
              {bedroomsForFlatType(listing.flat_type)}
            </DetailRow>
            <DetailRow label="Floor area" testID="listing-flat-area">
              {listing.floor_area_sqft} sqft
            </DetailRow>
            <DetailRow label="Lease term" testID="listing-lease-term">
              {listing.lease_months} months
            </DetailRow>
            <DetailRow
              label="Available from"
              testID="listing-available-from"
            >
              {formatAvailableDate(listing.available_from)}
            </DetailRow>
          </View>
          <View style={styles.actions}>
            <EnquiryButton listingId={listing.id} />
            <ReportDialog targetId={listing.id} targetType="listing" />
          </View>
        </View>
      </View>

      <View
        accessibilityLabel="Listing photo gallery"
        style={styles.gallery}
        testID="listing-gallery"
      >
        {listing.photos.map((photo, index) => {
          const imageLabel = photo.alt || `${listing.title} photo ${index + 1}`;

          return (
            <Image
              accessibilityLabel={imageLabel}
              alt={imageLabel}
              key={`${photo.url}-${index}`}
              resizeMode="cover"
              source={{ uri: photo.url }}
              style={styles.galleryImage}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

type DetailRowProps = {
  children: ReactNode;
  label: string;
  testID?: string;
};

function DetailRow({ children, label, testID }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} testID={testID}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    gap: 36,
    minHeight: "100%",
    padding: 24
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  headerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 28
  },
  heading: {
    flexBasis: 420,
    flexGrow: 1,
    gap: 14
  },
  town: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8
  },
  title: {
    color: "#020617",
    fontSize: 38,
    fontWeight: "800",
    lineHeight: 46
  },
  description: {
    color: "#475569",
    fontSize: 18,
    lineHeight: 28
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
    flexBasis: 320,
    flexGrow: 1,
    gap: 8,
    maxWidth: 440,
    padding: 24
  },
  price: {
    color: "#0f766e",
    fontSize: 32,
    fontWeight: "800"
  },
  priceLabel: {
    color: "#64748b",
    fontSize: 14
  },
  definitionList: {
    gap: 0,
    marginTop: 18
  },
  detailRow: {
    borderTopColor: "#f1f5f9",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    paddingVertical: 14
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 14
  },
  detailValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right"
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20
  },
  galleryImage: {
    backgroundColor: "#ccfbf1",
    borderRadius: 24,
    flexBasis: 280,
    flexGrow: 1,
    height: 260,
    minWidth: 260
  },
  status: {
    color: "#475569",
    fontSize: 18
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 16,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 16,
    padding: 16
  }
});
