import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth-context";

export function AuthNav() {
  const router = useRouter();
  const { signOut, token, user } = useAuth();

  async function onSignOut() {
    await signOut();
    router.replace("/login" as Href);
  }

  if (!token) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/login" as Href)}
        style={styles.outlineButton}
        testID="nav-signin"
      >
        <Text style={styles.outlineText}>Sign in</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.authenticatedNav}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/dashboard/listings" as Href)}
        testID="nav-listings"
      >
        <Text style={styles.profileText}>Listings</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/favorites" as Href)}
        testID="nav-favorites"
      >
        <Text style={styles.profileText}>Favorites</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/profile" as Href)}
        testID="nav-profile"
      >
        <Text style={styles.profileText}>{user?.email ?? "Profile"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onSignOut}
        style={styles.outlineButton}
        testID="nav-signout"
      >
        <Text style={styles.outlineText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  authenticatedNav: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-end"
  },
  outlineButton: {
    borderColor: "#0f766e",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  outlineText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "700"
  },
  profileText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  }
});
