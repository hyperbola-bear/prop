import { loginSchema } from "@proppy/shared/schemas";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { mobileApiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Invalid email or password");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await mobileApiClient.auth.login(parsed.data);
      await signIn(response.token);
      router.replace("/profile" as Href);
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>Welcome back</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Sign in to Proppy
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          style={styles.input}
          testID="auth-email-input"
          value={email}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          autoComplete="current-password"
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          testID="auth-password-input"
          value={password}
        />
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={submit}
        style={[styles.submitButton, isSubmitting ? styles.disabled : null]}
        testID="auth-signin-submit"
      >
        <Text style={styles.submitText}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/signup" as Href)}
      >
        <Text style={styles.link}>Need an account? Sign up</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    gap: 18,
    minHeight: "100%",
    padding: 24
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
  field: {
    gap: 8,
    maxWidth: 520
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 14,
    borderWidth: 1,
    color: "#020617",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "700"
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 999,
    maxWidth: 180,
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
  link: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "700"
  }
});
