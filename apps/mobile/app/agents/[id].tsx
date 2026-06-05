import { agentReviewSchema, type AgentProfileResponse } from "@proppy/shared/schemas";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  agentReviewTypeLabel,
  fallbackAgentPhoto,
  formatAgentResponseTime
} from "../../lib/agent-profile";
import { mobileApiClient } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function AgentProfileScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { user } = useAuth();
  const agentId = useMemo(() => {
    if (Array.isArray(params.id)) {
      return params.id[0];
    }

    return params.id;
  }, [params.id]);

  const [agent, setAgent] = useState<AgentProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stars, setStars] = useState("5");
  const [body, setBody] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  const loadAgent = useCallback(async () => {
    if (!agentId) {
      setError("Agent not found.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const profile = await mobileApiClient.agents.get(agentId);
      setAgent(profile);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load this agent right now."
      );
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    let isMounted = true;

    async function loadWhenMounted() {
      await loadAgent();
    }

    if (isMounted) {
      void loadWhenMounted();
    }

    return () => {
      isMounted = false;
    };
  }, [loadAgent]);

  async function submitReview() {
    if (submitInFlightRef.current || isSubmitting) {
      return;
    }

    if (!agentId) {
      return;
    }

    setReviewError(null);
    setReviewSuccess(null);

    const parsed = agentReviewSchema.safeParse({
      stars: Number(stars),
      body
    });

    if (!parsed.success) {
      setReviewError("Stars must be 1 to 5 and review body is required.");
      return;
    }

    setIsSubmitting(true);
    submitInFlightRef.current = true;
    try {
      const created = await mobileApiClient.agents.review(agentId, parsed.data);
      setReviewSuccess(
        created.reviewType === "verified"
          ? "Review submitted as Verified."
          : "Review submitted as Unverified."
      );
      setBody("");
      await loadAgent();
    } catch (cause) {
      setReviewError(
        cause instanceof Error ? cause.message : "Unable to submit review."
      );
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Loading agent…</Text>
      </View>
    );
  }

  if (error || !agent) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Agent not found."}</Text>
      </View>
    );
  }

  const photoUrl = agent.photoUrl ?? fallbackAgentPhoto(agent.name);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileGrid}>
        <Image
          accessibilityLabel={`${agent.name} profile photo`}
          alt={`${agent.name} profile photo`}
          resizeMode="cover"
          source={{ uri: photoUrl }}
          style={styles.profilePhoto}
          testID="agent-profile"
        />

        <View style={styles.profileContent}>
          <Text style={styles.kicker}>Agent profile</Text>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>
              {agent.name}
            </Text>
            {agent.verified ? (
              <Text style={styles.verifiedBadge}>Verified</Text>
            ) : null}
          </View>
          <Text style={styles.bio}>
            {agent.bio ?? "This agent has not added a bio yet."}
          </Text>

          <View style={styles.statsGrid}>
            <StatCard label="Active listings" value={String(agent.listingsCount)} />
            <StatCard
              label="P50 response time"
              testID="agent-stats-p50"
              value={formatAgentResponseTime(agent.responseTime.p50Minutes)}
            />
            <StatCard
              label="P90 response time"
              testID="agent-stats-p90"
              value={formatAgentResponseTime(agent.responseTime.p90Minutes)}
            />
          </View>

          <View style={styles.metaGrid}>
            <MetaList items={agent.specialties} title="Specialties" />
            <MetaList items={agent.languages} title="Languages" />
          </View>
        </View>
      </View>

      <View style={styles.reviewGrid}>
        <View style={styles.reviewColumn}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          {agent.reviews.length === 0 ? (
            <Text style={styles.emptyText}>No reviews yet.</Text>
          ) : (
            agent.reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard} testID="agent-review-card">
                <View style={styles.reviewHeader}>
                  <Text
                    accessibilityLabel={`${review.stars} stars`}
                    style={styles.stars}
                  >
                    {"★".repeat(review.stars)}
                    {"☆".repeat(5 - review.stars)}
                  </Text>
                  <Text style={styles.reviewType}>
                    {agentReviewTypeLabel(review.reviewType)}
                  </Text>
                </View>
                <Text style={styles.reviewBody}>{review.body}</Text>
                <Text style={styles.reviewMeta}>
                  {review.reviewerName ?? "Proppy renter"}
                  {review.createdAt
                    ? ` · ${new Date(review.createdAt).toLocaleDateString("en-SG")}`
                    : ""}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.reviewForm} testID="agent-review-form">
          <Text style={styles.formTitle}>Leave a review</Text>
          {user ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Stars</Text>
                <TextInput
                  inputMode="numeric"
                  keyboardType="number-pad"
                  onChangeText={setStars}
                  style={styles.input}
                  testID="agent-review-stars"
                  value={stars}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Review</Text>
                <TextInput
                  multiline
                  onChangeText={setBody}
                  style={[styles.input, styles.reviewInput]}
                  testID="agent-review-body"
                  value={body}
                />
              </View>
              {reviewError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {reviewError}
                </Text>
              ) : null}
              {reviewSuccess ? (
                <Text style={styles.successText}>{reviewSuccess}</Text>
              ) : null}
              {Platform.OS === "web" ? (
                <WebSubmitButton
                  isSubmitting={isSubmitting}
                  onSubmit={() => void submitReview()}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={submitReview}
                  style={[
                    styles.submitButton,
                    isSubmitting ? styles.disabled : null
                  ]}
                  testID="agent-review-submit"
                >
                  <Text style={styles.submitText}>
                    {isSubmitting ? "Submitting…" : "Submit review"}
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text style={styles.emptyText}>Sign in to review this agent.</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/login" as Href)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Sign in</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  testID?: string;
};

function StatCard({ label, value, testID }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

type MetaListProps = {
  items: string[];
  title: string;
};

function MetaList({ items, title }: MetaListProps) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle}>{title}</Text>
      {items.length > 0 ? (
        items.map((item) => (
          <Text key={item} style={styles.metaItem}>
            • {item}
          </Text>
        ))
      ) : (
        <Text style={styles.emptyText}>Not provided.</Text>
      )}
    </View>
  );
}

function WebSubmitButton({
  isSubmitting,
  onSubmit
}: {
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <button
      data-testid="agent-review-submit"
      disabled={isSubmitting}
      onClick={onSubmit}
      onMouseDown={onSubmit}
      onPointerDown={onSubmit}
      style={{
        alignItems: "center",
        backgroundColor: "#0f766e",
        border: 0,
        borderRadius: 999,
        color: "#ffffff",
        cursor: isSubmitting ? "not-allowed" : "pointer",
        fontSize: 16,
        fontWeight: 800,
        maxWidth: 180,
        opacity: isSubmitting ? 0.65 : 1,
        padding: "14px 24px"
      }}
      type="button"
    >
      {isSubmitting ? "Submitting…" : "Submit review"}
    </button>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    gap: 12,
    minHeight: "100%",
    padding: 16
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 28
  },
  profilePhoto: {
    backgroundColor: "#ccfbf1",
    borderRadius: 28,
    flexBasis: 320,
    flexGrow: 1,
    height: 240,
    minWidth: 280
  },
  profileContent: {
    flexBasis: 460,
    flexGrow: 1,
    gap: 16
  },
  kicker: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  title: {
    color: "#020617",
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 48
  },
  verifiedBadge: {
    backgroundColor: "#ccfbf1",
    borderRadius: 999,
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  bio: {
    color: "#475569",
    fontSize: 18,
    lineHeight: 28
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: 150,
    flexGrow: 1,
    padding: 16
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13
  },
  statValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 6
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  metaCard: {
    flexBasis: 220,
    flexGrow: 1,
    gap: 6
  },
  metaTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800"
  },
  metaItem: {
    color: "#334155",
    fontSize: 15
  },
  reviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 24
  },
  reviewColumn: {
    flexBasis: 360,
    flexGrow: 1,
    gap: 14
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800"
  },
  reviewCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  stars: {
    color: "#d97706",
    fontSize: 18,
    fontWeight: "800"
  },
  reviewType: {
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  reviewBody: {
    color: "#1e293b",
    fontSize: 16,
    lineHeight: 24
  },
  reviewMeta: {
    color: "#64748b",
    fontSize: 13
  },
  reviewForm: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    flexBasis: 320,
    flexGrow: 1,
    gap: 14,
    maxWidth: 520,
    padding: 20
  },
  formTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800"
  },
  field: {
    gap: 8
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
  reviewInput: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 999,
    maxWidth: 180,
    paddingHorizontal: 24,
    paddingVertical: 14
  },
  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#0f766e",
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 120,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.65
  },
  emptyText: {
    color: "#64748b",
    fontSize: 15
  },
  status: {
    color: "#475569",
    fontSize: 18
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 16,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 16,
    padding: 16
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "700"
  },
  successText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800"
  }
});
