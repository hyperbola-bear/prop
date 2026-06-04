import { ApiClientError } from "@proppy/shared/api-client";
import { useRouter, type Href } from "expo-router";
import { createElement, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileApiClient } from "../../lib/api";

type ReportDialogProps = {
  targetType: "listing" | "message" | "agent" | "user";
  targetId: string;
  buttonLabel?: string;
  buttonTestID?: string;
};

export function ReportDialog({
  targetType,
  targetId,
  buttonLabel = "Report",
  buttonTestID = "report-button"
}: ReportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Suspected scam");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  async function submitReport() {
    const webReason =
      Platform.OS === "web"
        ? (globalThis.document?.querySelector(
            '[data-testid="report-reason"]'
          ) as HTMLInputElement | null)?.value
        : null;
    const webBody =
      Platform.OS === "web"
        ? (globalThis.document?.querySelector(
            '[data-testid="report-body"]'
          ) as HTMLTextAreaElement | null)?.value
        : null;
    const trimmedReason = (webReason ?? reason).trim();
    const trimmedBody = (webBody ?? body).trim();

    if (!trimmedReason || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setError("");

    try {
      await mobileApiClient.reports.create({
        body: trimmedBody || null,
        reason: trimmedReason,
        targetId,
        targetType
      });
      setBody("");
      setStatus("success");
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 401) {
        router.push("/login" as Href);
        return;
      }

      setStatus("error");
      setError("Unable to submit report. Please try again.");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setOpen(true);
          setStatus("idle");
          setError("");
        }}
        style={styles.reportButton}
        testID={buttonTestID}
      >
        <Text style={styles.reportButtonText}>{buttonLabel}</Text>
      </Pressable>

      {open ? (
        <View
          accessibilityLabel={`Report this ${targetType}`}
          accessibilityRole="alert"
          style={styles.overlay}
        >
          <View style={styles.dialog} testID="report-form">
            <View style={styles.dialogHeader}>
              <View style={styles.dialogTitleGroup}>
                <Text style={styles.dialogTitle}>Report this {targetType}</Text>
                <Text style={styles.dialogSubtitle}>
                  Tell our safety team what happened.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close report dialog"
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <Text nativeID={`report-reason-${targetId}`} style={styles.label}>
              Reason
            </Text>
            {Platform.OS === "web" ? (
              createElement("input", {
                "aria-labelledby": `report-reason-${targetId}`,
                "data-testid": "report-reason",
                onChange: (event) =>
                  setReason((event.currentTarget as HTMLInputElement).value),
                required: true,
                style: webStyles.input,
                value: reason
              })
            ) : (
              <TextInput
                accessibilityLabelledBy={`report-reason-${targetId}`}
                onChangeText={setReason}
                style={styles.input}
                testID="report-reason"
                value={reason}
              />
            )}

            <Text nativeID={`report-body-${targetId}`} style={styles.label}>
              Details
            </Text>
            {Platform.OS === "web" ? (
              createElement("textarea", {
                "aria-labelledby": `report-body-${targetId}`,
                "data-testid": "report-body",
                onChange: (event) =>
                  setBody((event.currentTarget as HTMLTextAreaElement).value),
                placeholder: "Add any extra context",
                rows: 4,
                style: webStyles.textArea,
                value: body
              })
            ) : (
              <TextInput
                accessibilityLabelledBy={`report-body-${targetId}`}
                multiline
                onChangeText={setBody}
                placeholder="Add any extra context"
                style={[styles.input, styles.textArea]}
                testID="report-body"
                value={body}
              />
            )}

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {status === "success" ? (
              <Text accessibilityRole="text" style={styles.success}>
                Report submitted.
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
                    "data-testid": "report-submit",
                    onClick: submitReport,
                    style: {
                      ...webStyles.submitButton,
                      ...(status === "submitting" || !reason.trim()
                        ? webStyles.disabledButton
                        : {})
                    },
                    type: "button"
                  },
                  status === "submitting" ? "Submitting…" : "Report"
                )
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={submitReport}
                  style={[
                    styles.submitButton,
                    status === "submitting" || !reason.trim()
                      ? styles.disabledButton
                      : null
                  ]}
                  testID="report-submit"
                >
                  <Text style={styles.submitButtonText}>
                    {status === "submitting" ? "Submitting…" : "Report"}
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
  reportButton: {
    borderColor: "#fecdd3",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  reportButtonText: {
    color: "#be123c",
    fontSize: 14,
    fontWeight: "800"
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
    backgroundColor: "#be123c",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  success: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top"
  }
});

const webStyles = {
  disabledButton: {
    opacity: 0.6
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    boxSizing: "border-box",
    color: "#0f172a",
    fontFamily: "inherit",
    fontSize: 16,
    marginTop: 8,
    padding: "10px 14px",
    width: "100%"
  },
  submitButton: {
    backgroundColor: "#be123c",
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
    minHeight: 100,
    padding: "10px 14px",
    resize: "vertical",
    width: "100%"
  }
} as const;
