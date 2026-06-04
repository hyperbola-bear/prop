import type { ListingSummary } from "@proppy/shared/types";
import { StyleSheet, Text, View } from "react-native";

type MobileMapViewProps = {
  listings: ListingSummary[];
  onOpenListing: (id: string) => void;
};

export function MobileMapView({ listings }: MobileMapViewProps) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>Map view not available on mobile (MVP)</Text>
      <Text style={styles.body}>
        {listings.length} listings are available in the matching list.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#475569",
    fontSize: 14
  },
  placeholder: {
    backgroundColor: "#ecfeff",
    borderColor: "#99f6e4",
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 20
  },
  title: {
    color: "#0f766e",
    fontSize: 18,
    fontWeight: "800"
  }
});
