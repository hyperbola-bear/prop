import type { ListingSummary } from "@proppy/shared/types";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthNav } from "../components/AuthNav";
import { ListingCard } from "../components/ListingCard";
import { MobileMapView } from "../components/search/MobileMapView";
import {
  FilterPanel,
  RadiusFilter,
  SaveSearchButton,
  SortAndViewControls
} from "../components/search/SearchControls";
import { mobileApiClient } from "../lib/api";
import {
  filtersFromParams,
  listingOptionsFromParams,
  queryStringFromFilters,
  type SearchFilterKey,
  type SearchFilters
} from "../lib/search-options";

export default function SearchScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<Record<string, string | string[]>>();
  const paramsKey = JSON.stringify(rawParams);
  const params = useMemo(
    () => JSON.parse(paramsKey) as Record<string, string | string[] | undefined>,
    [paramsKey]
  );
  const [filters, setFilters] = useState<SearchFilters>(() =>
    filtersFromParams(params)
  );
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const navigateWithFilters = useCallback(
    (nextFilters: SearchFilters) => {
      const query = queryStringFromFilters(nextFilters);
      router.push((query ? `/search?${query}` : "/search") as Href);
    },
    [router]
  );

  useEffect(() => {
    const nextFilters = filtersFromParams(params);
    setFilters(nextFilters);
  }, [params, paramsKey]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    mobileApiClient.listings
      .list(listingOptionsFromParams(params))
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
              : "Unable to load search results right now."
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
  }, [params, paramsKey]);

  function changeFilter(key: SearchFilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openListing(id: string) {
    router.push(`/listings/${id}` as Href);
  }

  const isMap = filters.view === "map";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <AuthNav />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>Search Singapore HDB rentals</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Find your next rental
          </Text>
          <Text style={styles.body}>
            Filter by town, flat type, lease, availability, furnishing, and MRT
            radius.
          </Text>
        </View>
        <SaveSearchButton filters={filters} />
      </View>

      <View style={styles.layout}>
        <View style={styles.sidebar}>
          <FilterPanel
            filters={filters}
            onApply={() => navigateWithFilters(filters)}
            onChangeFilter={changeFilter}
            onReset={() => router.push("/search" as Href)}
          />
          <RadiusFilter filters={filters} onChangeFilter={changeFilter} />
        </View>

        <View style={styles.resultsPane}>
          <SortAndViewControls
            filters={filters}
            onImmediateChange={(nextFilters) => {
              setFilters(nextFilters);
              navigateWithFilters(nextFilters);
            }}
          />

          {isLoading ? <Text style={styles.status}>Loading results…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!isLoading && !error && listings.length === 0 ? (
            <Text style={styles.empty}>No results</Text>
          ) : null}

          {!isLoading && !error && listings.length > 0 && isMap ? (
            <View style={styles.mapLayout}>
              <View style={styles.mapColumn}>
                <MobileMapView listings={listings} onOpenListing={openListing} />
              </View>
              <View accessibilityLabel="Visible listings" style={styles.mapList}>
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onPress={openListing}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {!isLoading && !error && listings.length > 0 && !isMap ? (
            <View accessibilityLabel="Search results" style={styles.grid}>
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onPress={openListing}
                />
              ))}
            </View>
          ) : null}
        </View>
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
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    justifyContent: "space-between"
  },
  heroText: {
    flexBasis: 420,
    flexGrow: 1,
    maxWidth: 780
  },
  kicker: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  layout: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 24
  },
  mapColumn: {
    flexBasis: 520,
    flexGrow: 1,
    minWidth: 320
  },
  mapLayout: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20
  },
  mapList: {
    flexBasis: 320,
    flexGrow: 1,
    gap: 16,
    maxHeight: 560,
    overflow: "scroll"
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  resultsPane: {
    flexBasis: 520,
    flexGrow: 999,
    gap: 18,
    minWidth: 320
  },
  sidebar: {
    flexBasis: 320,
    flexGrow: 1,
    gap: 16,
    maxWidth: 380
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
