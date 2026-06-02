import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AuthNav } from "../components/AuthNav";
import { mobileApiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { isHydrating, refreshUser, token, user } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);

  useEffect(() => {
    if (!isHydrating && !token) {
      router.replace("/login" as Href);
    }
  }, [isHydrating, router, token]);

  useEffect(() => {
    if (token && !user) {
      void refreshUser();
    }
  }, [refreshUser, token, user]);

  async function becomeLandlord() {
    setIsAddingRole(true);
    setError("");
    setMessage("");
    try {
      await mobileApiClient.auth.addRole({ role: "seller" });
      await refreshUser();
      setMessage("Seller role added. You can now become a landlord.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add role");
    } finally {
      setIsAddingRole(false);
    }
  }

  if (isHydrating || (token && !user)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Loading profile…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Redirecting to sign in…</Text>
      </View>
    );
  }

  const isSeller = user.roles.includes("seller");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <AuthNav />
      </View>

      <Text style={styles.kicker}>Account</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Your profile
      </Text>

      <View style={styles.card}>
        <ProfileRow label="Email" value={user.email} />
        <ProfileRow label="Phone" value={user.phone} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Roles</Text>
          <View style={styles.roleList}>
            {user.roles.map((role) => (
              <Text key={role} style={styles.rolePill}>
                {role}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {!isSeller ? (
        <Pressable
          accessibilityRole="button"
          disabled={isAddingRole}
          onPress={becomeLandlord}
          style={[styles.submitButton, isAddingRole ? styles.disabled : null]}
        >
          <Text style={styles.submitText}>
            {isAddingRole ? "Adding role…" : "Become a landlord"}
          </Text>
        </Pressable>
      ) : null}

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    gap: 20,
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
  nav: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between"
  },
  brand: {
    color: "#0f766e",
    fontSize: 22,
    fontWeight: "800"
  },
  kicker: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#020617",
    fontSize: 36,
    fontWeight: "800"
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 22,
    borderWidth: 1,
    gap: 0,
    maxWidth: 640,
    padding: 20
  },
  row: {
    borderTopColor: "#f1f5f9",
    borderTopWidth: 1,
    gap: 8,
    paddingVertical: 14
  },
  rowLabel: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700"
  },
  rowValue: {
    color: "#020617",
    fontSize: 18,
    fontWeight: "700"
  },
  roleList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  rolePill: {
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 999,
    maxWidth: 240,
    paddingHorizontal: 24,
    paddingVertical: 14
  },
  disabled: {
    opacity: 0.65
  },
  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  status: {
    color: "#475569",
    fontSize: 16
  },
  successText: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "700"
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "700"
  }
});
