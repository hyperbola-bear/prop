import type { OwnedListing } from "@proppy/shared/types";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AuthNav } from "../../components/AuthNav";
import { mobileApiClient } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { formatListingPrice } from "../../lib/listing-format";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: OwnedListing[] };

export default function DashboardListingsScreen() {
  const router = useRouter();
  const { isHydrating, token } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await mobileApiClient.me.listings();
      setState({ status: "ready", items: payload.items });
    } catch (cause) {
      setState({
        status: "error",
        message:
          cause instanceof Error ? cause.message : "Failed to load owned listings"
      });
    }
  }, []);

  useEffect(() => {
    if (!isHydrating && !token) {
      router.replace("/login" as Href);
      return;
    }
    if (token) {
      void load();
    }
  }, [isHydrating, load, router, token]);

  async function runAction(
    id: string,
    action: "pause" | "refresh" | "mark-rented" | "delist"
  ) {
    setBusyId(id);
    try {
      if (action === "pause") {
        await mobileApiClient.listings.pause(id);
      } else if (action === "refresh") {
        await mobileApiClient.listings.refresh(id);
      } else if (action === "mark-rented") {
        await mobileApiClient.listings.markRented(id);
      } else {
        await mobileApiClient.listings.delist(id);
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (isHydrating || (!token && state.status === "loading")) {
    return (
      <View style={styles.centered}>
        <Text style={styles.statusText}>Loading your dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <AuthNav />
      </View>

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Dashboard</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Your listings
          </Text>
          <Text style={styles.subtitle}>
            Manage HDB rental listings with the same actions as web.
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/listings/new" as Href)}
          style={styles.primaryButton}
          testID="dashboard-create-listing"
        >
          <Text style={styles.primaryButtonText}>Create listing</Text>
        </Pressable>
      </View>

      {state.status === "loading" ? (
        <Text style={styles.statusText}>Loading your listings…</Text>
      ) : null}
      {state.status === "error" ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {state.message}
        </Text>
      ) : null}

      {state.status === "ready" ? (
        <View style={styles.list}>
          {state.items.map((listing) => (
            <ListingRow
              busy={busyId === listing.id}
              key={listing.id}
              listing={listing}
              onAction={runAction}
              onEdit={(id) =>
                router.push(`/listings/new/1?listingId=${encodeURIComponent(id)}` as Href)
              }
            />
          ))}
          {state.items.length === 0 ? (
            <Text style={styles.statusText}>No owned listings yet.</Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ListingRow({
  busy,
  listing,
  onAction,
  onEdit
}: {
  busy: boolean;
  listing: OwnedListing;
  onAction: (
    id: string,
    action: "pause" | "refresh" | "mark-rented" | "delist"
  ) => Promise<void>;
  onEdit: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.listingTitle}>{listing.title}</Text>
        <Text style={styles.listingMeta}>
          {listing.block ?? "—"} {listing.street ?? ""} · {listing.flatType ?? "HDB"}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={styles.statusBadge} testID="listing-status-badge">
            {listing.status}
          </Text>
          <Text style={styles.photoBadge}>{listing.photoCount} photos</Text>
        </View>
      </View>
      <View style={styles.rentBlock}>
        <Text style={styles.rent}>{formatListingPrice(listing.priceSgd)}</Text>
        <Text style={styles.refreshed}>
          Refreshed{" "}
          {listing.refreshedAt
            ? new Date(listing.refreshedAt).toLocaleString("en-SG")
            : "—"}
        </Text>
      </View>
      <View style={styles.actionRow}>
        <ActionButton
          disabled={busy}
          label="Edit"
          onPress={() => onEdit(listing.id)}
          testID="listing-edit"
        />
        <ActionButton
          disabled={busy}
          label="Pause"
          onPress={() => void onAction(listing.id, "pause")}
          testID="listing-pause"
        />
        <ActionButton
          disabled={busy}
          label="Refresh"
          onPress={() => void onAction(listing.id, "refresh")}
          testID="listing-refresh"
        />
        <ActionButton
          disabled={busy}
          label="Mark as rented"
          onPress={() => void onAction(listing.id, "mark-rented")}
          testID="listing-mark-rented"
        />
        <ActionButton
          danger
          disabled={busy}
          label="Delist"
          onPress={() => void onAction(listing.id, "delist")}
          testID="listing-delist"
        />
      </View>
    </View>
  );
}

function ActionButton({
  danger,
  disabled,
  label,
  onPress,
  testID
}: {
  danger?: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        danger ? styles.dangerButton : null,
        disabled ? styles.disabledButton : null
      ]}
      testID={testID}
    >
      <Text style={[styles.actionButtonText, danger ? styles.dangerText : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  actionButtonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800"
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  brand: {
    color: "#0f766e",
    fontSize: 22,
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
    gap: 24,
    minHeight: "100%",
    padding: 24
  },
  dangerButton: {
    borderColor: "#fecaca"
  },
  dangerText: {
    color: "#b91c1c"
  },
  disabledButton: {
    opacity: 0.55
  },
  errorText: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 14,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "700",
    padding: 12
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "space-between"
  },
  kicker: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  list: {
    gap: 14
  },
  listingMeta: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4
  },
  listingTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800"
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  photoBadge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  refreshed: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4
  },
  rent: {
    color: "#0f766e",
    fontSize: 20,
    fontWeight: "800"
  },
  rentBlock: {
    minWidth: 170
  },
  row: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.10)",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    justifyContent: "space-between",
    padding: 18
  },
  rowMain: {
    flexBasis: 280,
    flexGrow: 1
  },
  statusBadge: {
    backgroundColor: "#e0f2fe",
    borderRadius: 999,
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusText: {
    color: "#475569",
    fontSize: 16
  },
  subtitle: {
    color: "#64748b",
    fontSize: 16,
    marginTop: 8
  },
  title: {
    color: "#020617",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 6
  }
});
