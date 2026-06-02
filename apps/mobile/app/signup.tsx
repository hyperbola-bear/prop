import { signupSchema, type SignupInput } from "@proppy/shared/schemas";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
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

type FieldErrors = Partial<Record<keyof SignupInput, string>>;

const ROLES: Array<{ label: string; value: SignupInput["role"] }> = [
  { label: "buyer/renter", value: "buyer" },
  { label: "seller/landlord", value: "seller" },
  { label: "agent", value: "agent" }
];

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+65");
  const [role, setRole] = useState<SignupInput["role"]>("buyer");
  const [pdpaConsent, setPdpaConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const parsed = signupSchema.safeParse({
      email,
      password,
      phone,
      role,
      pdpaConsent
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const [field] = issue.path;
        if (typeof field === "string") {
          nextErrors[field as keyof SignupInput] = issue.message;
        }
      }
      setErrors(nextErrors);
      setFormError("");
      return;
    }

    setErrors({});
    setFormError("");
    setIsSubmitting(true);

    try {
      await mobileApiClient.auth.signup(parsed.data);
      router.replace(
        `/signup/verify-phone?phone=${encodeURIComponent(parsed.data.phone)}` as Href
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Signup failed. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>Create account</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Sign up for Proppy
      </Text>
      <Text style={styles.body}>
        Use the same account details on web and mobile. Phone OTP is mocked in
        development, and 000000 verifies test signups.
      </Text>

      <Field label="Email" error={errors.email}>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          style={styles.input}
          testID="auth-email-input"
          value={email}
        />
      </Field>

      <Field label="Password" error={errors.password}>
        <TextInput
          autoComplete="new-password"
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          testID="auth-password-input"
          value={password}
        />
      </Field>

      <Field label="Phone (+65 prefix)" error={errors.phone}>
        <TextInput
          autoComplete="tel"
          inputMode="tel"
          onChangeText={setPhone}
          style={styles.input}
          testID="auth-phone-input"
          value={phone}
        />
      </Field>

      <View style={styles.field}>
        <Text style={styles.label}>Role</Text>
        <View style={styles.roleGrid}>
          {ROLES.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => setRole(option.value)}
              style={[
                styles.roleButton,
                role === option.value ? styles.roleButtonSelected : null
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  role === option.value ? styles.roleTextSelected : null
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.consentBox}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: pdpaConsent }}
          onPress={() => setPdpaConsent((checked) => !checked)}
          style={styles.consentRow}
          testID="auth-pdpa-checkbox"
        >
          <View style={[styles.checkbox, pdpaConsent ? styles.checked : null]}>
            <Text style={styles.checkmark}>{pdpaConsent ? "✓" : ""}</Text>
          </View>
          <Text style={styles.consentText}>
            I consent to the PDPA terms and allow Proppy to process my personal
            data for account creation.
          </Text>
        </Pressable>
        {errors.pdpaConsent ? (
          <Text style={styles.errorText}>{errors.pdpaConsent}</Text>
        ) : null}
      </View>

      {formError ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {formError}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={submit}
        style={[styles.submitButton, isSubmitting ? styles.disabled : null]}
        testID="auth-signup-submit"
      >
        <Text style={styles.submitText}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  children,
  error,
  label
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
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
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  roleButton: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  roleButtonSelected: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  roleText: {
    color: "#334155",
    fontWeight: "700"
  },
  roleTextSelected: {
    color: "#ffffff"
  },
  consentBox: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    maxWidth: 720,
    padding: 16
  },
  consentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#0f766e",
    borderRadius: 4,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  checked: {
    backgroundColor: "#0f766e"
  },
  checkmark: {
    color: "#ffffff",
    fontWeight: "900"
  },
  consentText: {
    color: "#334155",
    flex: 1,
    fontSize: 14,
    lineHeight: 20
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
    maxWidth: 260,
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
