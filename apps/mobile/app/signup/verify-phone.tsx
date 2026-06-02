import { otpVerifySchema } from "@proppy/shared/schemas";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { mobileApiClient } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = useMemo(() => {
    const value = params.phone;
    return Array.isArray(value) ? value[0] : (value ?? "");
  }, [params.phone]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const parsed = otpVerifySchema.safeParse({ phone, code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid OTP code");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await mobileApiClient.auth.verifyOtp(parsed.data);
      await signIn(response.token);
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid OTP code");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>Phone verification</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Verify your phone
      </Text>
      <Text style={styles.body}>
        Enter the one-time password for {phone || "your phone"}. In development
        builds, use 000000.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>One-time password</Text>
        <TextInput
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          onChangeText={setCode}
          placeholder="000000"
          style={styles.input}
          testID="auth-otp-input"
          value={code}
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
        testID="auth-otp-submit"
      >
        <Text style={styles.submitText}>
          {isSubmitting ? "Verifying…" : "Verify phone"}
        </Text>
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
  body: {
    color: "#475569",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 720
  },
  field: {
    gap: 8,
    maxWidth: 360
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
    fontSize: 18,
    letterSpacing: 4,
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
    maxWidth: 220,
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
  }
});
