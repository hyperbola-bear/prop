import { ApiClientError } from "@proppy/shared/api-client";
import { useRouter, type Href } from "expo-router";
import { createElement, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileApiClient } from "../../lib/api";

export function EnquiryButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submitEnquiry() {
    const webBody =
      Platform.OS === "web"
        ? (globalThis.document?.querySelector(
            '[data-testid="enquiry-body"]'
          ) as HTMLTextAreaElement | null)?.value
        : null;
    const trimmed = (webBody ?? body).trim();
    if (!trimmed || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const result = await mobileApiClient.enquiries.create({
        body: trimmed,
        listingId
      });
      setBody("");
      setOpen(false);
      router.push(`/messages/${result.conversationId}` as Href);
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 401) {
        router.push("/login" as Href);
        return;
      }

      setError("Unable to send enquiry. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setOpen(true);
          setError("");
        }}
        style={styles.enquiryButton}
        testID="enquiry-button"
      >
        <Text style={styles.enquiryButtonText}>Send enquiry</Text>
      </Pressable>

      {open ? (
        <View
          accessibilityLabel="Send enquiry"
          accessibilityRole="alert"
          style={styles.overlay}
        >
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <View style={styles.dialogTitleGroup}>
                <Text style={styles.dialogTitle}>Send enquiry</Text>
                <Text style={styles.dialogSubtitle}>
                  Start a conversation with the owner about this listing.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close enquiry dialog"
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <Text nativeID={`enquiry-body-${listingId}`} style={styles.label}>
              Message
            </Text>
            {Platform.OS === "web" ? (
              createElement("textarea", {
                "aria-labelledby": `enquiry-body-${listingId}`,
                "data-testid": "enquiry-body",
                onChange: (event) =>
                  setBody((event.currentTarget as HTMLTextAreaElement).value),
                placeholder: "Is this still available?",
                rows: 5,
                style: webStyles.textArea,
                value: body
              })
            ) : (
              <TextInput
                accessibilityLabelledBy={`enquiry-body-${listingId}`}
                multiline
                onChangeText={setBody}
                placeholder="Is this still available?"
                style={[styles.input, styles.textArea]}
                testID="enquiry-body"
                value={body}
              />
            )}

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              {Platform.OS === "web" ? (
                createElement(
                  "button",
                  {
                    "data-testid": "enquiry-submit",
                    onClick: submitEnquiry,
                    style: {
                      ...webStyles.submitButton,
                      ...(submitting || !body.trim() ? webStyles.disabledButton : {})
                    },
                    type: "button"
                  },
                  submitting ? "Sending…" : "Send"
                )
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={submitEnquiry}
                  style={[
                    styles.submitButton,
                    submitting || !body.trim() ? styles.disabledButton : null
                  ]}
                  testID="enquiry-submit"
                >
                  <Text style={styles.submitButtonText}>
                    {submitting ? "Sending…" : "Send"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 24
  },
  closeButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  closeButtonText: {
    color: "#64748b",
    fontSize: 28
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    maxWidth: 560,
    padding: 24,
    width: "100%"
  },
  dialogHeader: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between"
  },
  dialogSubtitle: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4
  },
  dialogTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800"
  },
  dialogTitleGroup: {
    flexShrink: 1
  },
  disabledButton: {
    opacity: 0.6
  },
  enquiryButton: {
    backgroundColor: "#0f766e",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  enquiryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  error: {
    color: "#be123c",
    fontSize: 14,
    marginTop: 12
  },
  input: {
    borderColor: "#cbd5e1",
    borderRadius: 14,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 18
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    padding: 20,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 50
  },
  secondaryButton: {
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  },
  submitButton: {
    backgroundColor: "#0f766e",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top"
  }
});

const webStyles = {
  disabledButton: {
    opacity: 0.6
  },
  submitButton: {
    backgroundColor: "#0f766e",
    border: "0",
    borderRadius: 999,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
    padding: "11px 20px"
  },
  textArea: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    boxSizing: "border-box",
    color: "#0f172a",
    fontFamily: "inherit",
    fontSize: 16,
    marginTop: 8,
    minHeight: 120,
    padding: "10px 14px",
    resize: "vertical",
    width: "100%"
  }
} as const;
