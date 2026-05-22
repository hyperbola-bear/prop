import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Proppy</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Browse rentals in Singapore
      </Text>
      <Text style={styles.body}>
        The mobile workspace is ready for the rental browse flow.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 32,
    backgroundColor: "#f8fafc"
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
    fontSize: 18
  }
});
