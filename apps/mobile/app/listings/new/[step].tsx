import type { OnemapSuggestion, SellerClient } from "@proppy/shared/api-client";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React from "react";
import { useEffect, useMemo, useReducer, useState } from "react";
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
import { AuthNav } from "../../../components/AuthNav";
import { mobileApiClient } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import {
  FLAT_TYPES,
  FLOOR_BANDS,
  FURNISHING,
  ROOM_TAGS,
  blankListingDraft,
  buildCreateListingPayload,
  dollarsToCents,
  fallbackSuggestion,
  listingWizardReducer,
  missingFieldsForDraft,
  movePhoto,
  type ListingDraft,
  type WizardPhoto
} from "../../../lib/listing-wizard";

type UploadFile = {
  blob: Blob;
  localUrl: string;
  name: string;
  size: number;
  type: "image/jpeg" | "image/png" | "image/webp";
};

type EditableRoomTag = (typeof ROOM_TAGS)[number];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function stepParam(value: string | string[] | undefined): number {
  const parsed = Number(firstParam(value) ?? "1");
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(8, Math.max(1, parsed));
}

function normalizeImageType(type: string | undefined | null): UploadFile["type"] {
  return type === "image/png" || type === "image/webp" ? type : "image/jpeg";
}

async function uploadToPresignedUrl(
  presign: {
    fields: Record<string, string>;
    headers?: Record<string, string>;
    method?: "POST" | "PUT";
    url: string;
  },
  file: UploadFile
): Promise<Response> {
  if (presign.method === "POST") {
    const form = new FormData();
    for (const [field, value] of Object.entries(presign.fields)) {
      form.append(field, value);
    }
    form.append("file", file.blob, file.name);
    return fetch(presign.url, { body: form, method: "POST" });
  }

  return fetch(presign.url, {
    body: file.blob,
    headers: presign.headers ?? { "Content-Type": file.type },
    method: "PUT"
  });
}

export default function ListingWizardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    listingId?: string | string[];
    step?: string | string[];
  }>();
  const initialStep = useMemo(() => stepParam(params.step), [params.step]);
  const listingId = useMemo(() => firstParam(params.listingId), [params.listingId]);
  const isEdit = Boolean(listingId);
  const { isHydrating, refreshUser, token, user } = useAuth();
  const [draft, dispatch] = useReducer(listingWizardReducer, blankListingDraft());
  const [step, setStep] = useState(initialStep);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<OnemapSuggestion[]>([]);
  const [addressQuery, setAddressQuery] = useState("");
  const [clients, setClients] = useState<SellerClient[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState("");

  const isAgent = Boolean(user?.roles.includes("agent"));
  const isAgentNewListing = isAgent && !isEdit;
  const totalSteps = isAgentNewListing ? 8 : 7;
  const contentStep = isAgentNewListing ? step - 1 : step;
  const isMandateStep = isAgentNewListing && step === 1;
  const missingFields = useMemo(() => missingFieldsForDraft(draft), [draft]);

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

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    if (step > totalSteps) {
      setStep(totalSteps);
    }
  }, [step, totalSteps]);

  useEffect(() => {
    if (!listingId || !token) {
      return;
    }

    let isMounted = true;
    mobileApiClient.me
      .listing(listingId)
      .then((payload) => {
        if (!isMounted) {
          return;
        }
        const nextDraft: ListingDraft = {
          ...blankListingDraft(),
          id: payload.id,
          status: payload.status,
          title: payload.title,
          description: payload.description ?? "",
          ownerUserId: payload.ownerUserId ?? "",
          freeformSellerEmail: "",
          mandateVia:
            payload.representedVia === "agent_mandate" ||
            payload.representedVia === "agent_no_mandate"
              ? payload.representedVia
              : "",
          propertyType: "hdb",
          block: payload.block ?? "",
          street: payload.street ?? "",
          postal: payload.postal ?? "",
          lat: payload.latitude ?? "",
          lng: payload.longitude ?? "",
          addressId: payload.addressId ?? undefined,
          blockId: payload.blockId ?? undefined,
          flatType: payload.flatType ?? "",
          floorLevelBand: payload.floorLevelBand ?? "",
          floorAreaSqft: payload.floorAreaSqft ? String(payload.floorAreaSqft) : "",
          monthlyRent: payload.priceSgd ? String(payload.priceSgd / 100) : "",
          leaseMonths: payload.leaseMonths ? String(payload.leaseMonths) : "12",
          availableFrom: payload.availableFrom ?? blankListingDraft().availableFrom,
          furnishing: payload.furnishing ?? "",
          floorPlanUrl: payload.floorPlan?.url ?? "",
          floorPlanKey: payload.floorPlan?.objectPath ?? "",
          photos: payload.photos.map((photo) => ({
            id: photo.id,
            roomTag: photo.roomTag ?? "Living",
            sortOrder: photo.sortOrder,
            url: photo.url
          }))
        };
        dispatch({ type: "reset", draft: nextDraft });
        setAddressQuery(`${payload.block ?? ""} ${payload.street ?? ""}`.trim());
      })
      .catch((cause: unknown) => {
        if (isMounted) {
          setErrors({
            load: cause instanceof Error ? cause.message : "Failed to load listing"
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [listingId, token]);

  useEffect(() => {
    if (!isAgent) {
      return;
    }

    const timeout = setTimeout(() => {
      mobileApiClient.me
        .clients(clientQuery.trim())
        .then((payload) => setClients(payload.items))
        .catch(() => setClients([]));
    }, 250);

    return () => clearTimeout(timeout);
  }, [clientQuery, isAgent]);

  useEffect(() => {
    if (contentStep !== 2 || addressQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(() => {
      mobileApiClient.onemap
        .search(addressQuery)
        .then((items) =>
          setSuggestions(items.length > 0 ? items : [fallbackSuggestion(addressQuery)])
        )
        .catch(() => setSuggestions([fallbackSuggestion(addressQuery)]));
    }, 300);

    return () => clearTimeout(timeout);
  }, [addressQuery, contentStep]);

  function goToStep(nextStep: number) {
    const bounded = Math.min(totalSteps, Math.max(1, nextStep));
    setStep(bounded);
  }

  async function ensureDraft() {
    if (draft.id) {
      return draft.id;
    }

    const created = await mobileApiClient.listings.create(
      buildCreateListingPayload(draft, isAgent)
    );
    dispatch({ type: "patch", patch: { id: created.id, status: created.status } });
    return created.id;
  }

  async function patchListing(patch: Record<string, unknown> = {}) {
    const id = await ensureDraft();
    await mobileApiClient.listings.update(id, patch);
    setLastSaved(new Date().toLocaleTimeString("en-SG"));
  }

  async function resolveAddress(suggestion: OnemapSuggestion) {
    setIsBusy(true);
    setErrors({});
    try {
      const fallback = fallbackSuggestion(addressQuery);
      const resolved = await mobileApiClient.addresses.resolve({
        address: suggestion.ADDRESS,
        block: suggestion.BLK_NO || fallback.BLK_NO,
        building: suggestion.BUILDING,
        lat: suggestion.LATITUDE,
        lng: suggestion.LONGITUDE,
        postal: suggestion.POSTAL,
        street: suggestion.ROAD_NAME || addressQuery
      });
      const patch = {
        addressId: resolved.addressId,
        block: suggestion.BLK_NO || fallback.BLK_NO,
        blockId: resolved.blockId,
        lat: suggestion.LATITUDE,
        lng: suggestion.LONGITUDE,
        postal: suggestion.POSTAL,
        street: suggestion.ROAD_NAME || addressQuery
      };
      dispatch({ type: "patch", patch });
      await patchListing({ addressId: resolved.addressId, blockId: resolved.blockId });
      goToStep(step + 1);
    } catch (cause) {
      setErrors({
        address: cause instanceof Error ? cause.message : "Address selection failed"
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadFiles(files: UploadFile[]) {
    if (files.length === 0) {
      return;
    }
    setIsBusy(true);
    setErrors({});
    try {
      const id = await ensureDraft();
      const nextPhotos = [...draft.photos];
      for (const file of files) {
        const presign = await mobileApiClient.uploads.presign({
          contentType: file.type,
          fileSize: file.size,
          listingId: id,
          scope: "listing-photo"
        });
        const put = await uploadToPresignedUrl(presign, file);
        if (!put.ok) {
          throw new Error(`Upload failed (${put.status})`);
        }
        const created = await mobileApiClient.listings.addPhoto(id, {
          altText: file.name || "Listing photo",
          key: presign.key,
          roomTag: "Living"
        });
        nextPhotos.push({
          id: created.id,
          roomTag: "Living",
          sortOrder: created.sortOrder,
          url: file.localUrl
        });
      }
      dispatch({ type: "setPhotos", photos: nextPhotos });
    } catch (cause) {
      setErrors({
        photos: cause instanceof Error ? cause.message : "Photo upload failed"
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadFloorPlan(file: UploadFile) {
    setIsBusy(true);
    setErrors({});
    try {
      const id = await ensureDraft();
      const presign = await mobileApiClient.uploads.presign({
        contentType: file.type,
        fileSize: file.size,
        listingId: id,
        scope: "listing-floor-plan"
      });
      const put = await uploadToPresignedUrl(presign, file);
      if (!put.ok) {
        throw new Error(`Floor plan upload failed (${put.status})`);
      }
      await mobileApiClient.listings.addFloorPlan(id, {
        key: presign.key,
        zone: { roomTag: "Living" }
      });
      dispatch({
        type: "patch",
        patch: { floorPlanKey: presign.key, floorPlanUrl: file.localUrl }
      });
    } catch (cause) {
      setErrors({
        floorPlan: cause instanceof Error ? cause.message : "Floor plan upload failed"
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function reorderPhoto(photoId: string, direction: "up" | "down") {
    const reordered = movePhoto(draft.photos, photoId, direction);
    if (reordered === draft.photos) {
      return;
    }
    dispatch({ type: "setPhotos", photos: reordered });
    if (draft.id) {
      await mobileApiClient.listings.reorderPhotos(draft.id, {
        orderedIds: reordered.map((photo) => photo.id)
      });
    }
  }

  async function updatePhotoRoomTag(photoId: string, roomTag: string) {
    if (!draft.id) {
      return;
    }
    if (!ROOM_TAGS.includes(roomTag as EditableRoomTag)) {
      return;
    }
    try {
      await mobileApiClient.listings.updatePhotoRoomTag(draft.id, photoId, {
        roomTag: roomTag as EditableRoomTag
      });
      setLastSaved(new Date().toLocaleTimeString("en-SG"));
    } catch (cause) {
      setErrors({
        photos: cause instanceof Error ? cause.message : "Room tag update failed"
      });
    }
  }

  async function next() {
    setErrors({});
    try {
      if (isMandateStep) {
        if (!draft.ownerUserId && !draft.freeformSellerEmail.trim()) {
          setErrors({
            ownerUserId: "Select a seller or enter a seller email before continuing."
          });
          return;
        }
        if (!draft.ownerUserId && draft.freeformSellerEmail.trim()) {
          const client = await mobileApiClient.me.createClient({
            email: draft.freeformSellerEmail.trim()
          });
          dispatch({
            type: "patch",
            patch: {
              ownerUserId: client.id,
              mandateVia: "agent_no_mandate"
            }
          });
        }
        goToStep(step + 1);
        return;
      }
      if (contentStep === 1) {
        if (draft.propertyType !== "hdb") {
          setErrors({ propertyType: "HDB is required for this MVP." });
          return;
        }
        await ensureDraft();
      }
      if (contentStep === 2 && (!draft.addressId || !draft.blockId)) {
        setErrors({ address: "Select a OneMap suggestion before continuing." });
        return;
      }
      if (contentStep === 3) {
        if (!draft.flatType) {
          setErrors({ flatType: "Flat type is required." });
          return;
        }
        if (!draft.floorAreaSqft) {
          setErrors({ floorAreaSqft: "Floor area is required." });
          return;
        }
        await patchListing({
          blockId: draft.blockId,
          flatType: draft.flatType,
          floorAreaSqft: Number(draft.floorAreaSqft),
          floorLevelBand: draft.floorLevelBand || null
        });
      }
      if (contentStep === 4 && draft.photos.length < 3) {
        setErrors({ photos: "At least 3 photos required." });
        return;
      }
      if (contentStep === 6) {
        const rent = Number(draft.monthlyRent);
        if (Number.isNaN(rent) || rent < 100 || rent > 50000) {
          setErrors({ monthlyRent: "Monthly rent must be between S$100 and S$50,000." });
          return;
        }
        await patchListing({
          availableFrom: draft.availableFrom,
          description: draft.description,
          furnishing: draft.furnishing,
          leaseMonths: Number(draft.leaseMonths),
          priceSgd: dollarsToCents(draft.monthlyRent),
          title: draft.title
        });
      }
      goToStep(step + 1);
    } catch (cause) {
      setErrors({
        submit: cause instanceof Error ? cause.message : "Could not save this step"
      });
    }
  }

  async function publish() {
    if (missingFields.length > 0) {
      setErrors({ publish: missingFields.join(", ") });
      return;
    }
    setIsBusy(true);
    setErrors({});
    try {
      const id = await ensureDraft();
      await patchListing({
        addressId: draft.addressId,
        availableFrom: draft.availableFrom,
        blockId: draft.blockId,
        description: draft.description,
        flatType: draft.flatType,
        floorAreaSqft: Number(draft.floorAreaSqft),
        floorLevelBand: draft.floorLevelBand || null,
        furnishing: draft.furnishing,
        leaseMonths: Number(draft.leaseMonths),
        priceSgd: dollarsToCents(draft.monthlyRent),
        title: draft.title
      });

      if (isEdit && draft.status === "published") {
        router.replace("/dashboard/listings" as Href);
        return;
      }

      await mobileApiClient.listings.publish(id);
      router.replace(`/listings/${id}` as Href);
    } catch (cause) {
      setErrors({ publish: cause instanceof Error ? cause.message : "Publish failed" });
    } finally {
      setIsBusy(false);
    }
  }

  if (isHydrating || !token || !user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.status}>Preparing listing wizard…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.brand}>Proppy</Text>
        <AuthNav />
      </View>

      <View style={styles.header}>
        <Text style={styles.kicker}>{isEdit ? "Edit listing" : "Create listing"}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          HDB rental listing wizard
        </Text>
        <Text style={styles.subtitle}>
          Step {step} of {totalSteps}
          {lastSaved ? ` · Saved at ${lastSaved}` : ""}
        </Text>
      </View>

      {errors.load ? <AlertText>{errors.load}</AlertText> : null}
      {errors.submit ? <AlertText>{errors.submit}</AlertText> : null}

      {isMandateStep ? (
        <View style={styles.card} testID="wizard-step-1">
          <SectionTitle
            title="Acting on behalf of"
            body="Select a seller from prior mandate clients, search by email or phone, or enter a seller email to create a pending seller."
          />
          <LabeledInput
            label="Search sellers"
            onChangeText={setClientQuery}
            placeholder="landlord1@proppy.test or +65…"
            testID="client-search-input"
            value={clientQuery}
          />
          <ClientPicker
            clients={clients}
            onSelect={(ownerUserId) =>
              dispatch({
                type: "patch",
                patch: {
                  ownerUserId,
                  freeformSellerEmail: ownerUserId ? "" : draft.freeformSellerEmail,
                  mandateVia: ownerUserId ? "agent_mandate" : ""
                }
              })
            }
            selectedClientId={draft.ownerUserId}
          />
          <LabeledInput
            label="Freeform seller email"
            onChangeText={(freeformSellerEmail) =>
              dispatch({
                type: "patch",
                patch: {
                  freeformSellerEmail,
                  ownerUserId: freeformSellerEmail ? "" : draft.ownerUserId,
                  mandateVia: freeformSellerEmail ? "agent_no_mandate" : draft.mandateVia
                }
              })
            }
            placeholder="seller@example.com"
            testID="freeform-seller-email"
            value={draft.freeformSellerEmail}
          />
          {draft.ownerUserId ? (
            <Text style={styles.status}>Selected seller will own this listing.</Text>
          ) : null}
          {errors.ownerUserId ? <AlertText>{errors.ownerUserId}</AlertText> : null}
        </View>
      ) : null}

      {contentStep === 1 ? (
        <View style={styles.card} testID={`wizard-step-${step}`}>
          <SectionTitle title="Property type" />
          <View style={styles.choiceGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                dispatch({ type: "patch", patch: { propertyType: "hdb" } })
              }
              style={[
                styles.choiceCard,
                draft.propertyType === "hdb" ? styles.choiceSelected : null
              ]}
              testID="property-type-hdb"
            >
              <Text style={styles.choiceTitle}>HDB</Text>
              <Text style={styles.choiceBody}>Available now for rentals.</Text>
            </Pressable>
            {["Condo", "Landed"].map((label) => (
              <View key={label} style={[styles.choiceCard, styles.disabledChoice]}>
                <Text style={styles.choiceTitle}>{label}</Text>
                <Text style={styles.choiceBody}>Coming soon</Text>
              </View>
            ))}
          </View>
          {errors.propertyType ? <AlertText>{errors.propertyType}</AlertText> : null}
        </View>
      ) : null}

      {contentStep === 2 ? (
        <View style={styles.card} testID={`wizard-step-${step}`}>
          <SectionTitle title="Address" />
          <LabeledInput
            label="OneMap autocomplete"
            onChangeText={setAddressQuery}
            placeholder="Toa Payoh Lor 1"
            testID="address-onemap-input"
            value={addressQuery}
          />
          {suggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${suggestion.SEARCHVAL}-${suggestion.POSTAL}`}
                  onPress={() => void resolveAddress(suggestion)}
                  style={styles.suggestionButton}
                  testID="address-suggestion"
                >
                  <Text style={styles.suggestionTitle}>{suggestion.SEARCHVAL}</Text>
                  <Text style={styles.suggestionBody}>{suggestion.ADDRESS}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.summaryGrid}>
            <ReadOnlyValue label="Block" value={draft.block} />
            <ReadOnlyValue label="Street" value={draft.street} />
            <ReadOnlyValue label="Postal" value={draft.postal} />
            <ReadOnlyValue label="Lat" value={draft.lat} />
            <ReadOnlyValue label="Lng" value={draft.lng} />
          </View>
          {errors.address ? <AlertText>{errors.address}</AlertText> : null}
        </View>
      ) : null}

      {contentStep === 3 ? (
        <View style={styles.card} testID={`wizard-step-${step}`}>
          <SectionTitle title="Unit details" />
          <View style={styles.formGrid}>
            <SelectInput
              label="Flat type"
              onChange={(flatType) => dispatch({ type: "patch", patch: { flatType } })}
              options={["", ...FLAT_TYPES]}
              testID="unit-flat-type"
              value={draft.flatType}
            />
            <SelectInput
              label="Floor level band"
              onChange={(floorLevelBand) =>
                dispatch({ type: "patch", patch: { floorLevelBand } })
              }
              options={["", ...FLOOR_BANDS]}
              testID="unit-floor-level"
              value={draft.floorLevelBand}
            />
            <LabeledInput
              inputMode="numeric"
              label="Floor area (sqft)"
              onChangeText={(floorAreaSqft) =>
                dispatch({ type: "patch", patch: { floorAreaSqft } })
              }
              testID="unit-floor-area"
              value={draft.floorAreaSqft}
            />
          </View>
          {errors.flatType ? <AlertText>{errors.flatType}</AlertText> : null}
          {errors.floorAreaSqft ? <AlertText>{errors.floorAreaSqft}</AlertText> : null}
        </View>
      ) : null}

      {contentStep === 4 ? (
        <View style={styles.card} testID={`wizard-step-${step}`}>
          <SectionTitle
            title="Photos"
            body="Upload at least 3 photos. Use Move up / Move down to reorder on Expo Web."
          />
          <FilePicker multiple onFiles={(files) => void uploadFiles(files)} testID="photos-file-input" />
          <View style={styles.photoGrid}>
            {draft.photos.map((photo, index) => (
              <View key={photo.id} style={styles.photoCard}>
                <Image
                  accessibilityLabel={`Listing photo ${index + 1}`}
                  alt={`Listing photo ${index + 1}`}
                  resizeMode="cover"
                  source={{ uri: photo.url }}
                  style={styles.photo}
                />
                <View testID={`room-tag-${photo.id}`}>
                  <SelectInput
                    label="Room tag"
                    onChange={(roomTag) => {
                      dispatch({
                        type: "setPhotos",
                        photos: draft.photos.map((candidate) =>
                          candidate.id === photo.id ? { ...candidate, roomTag } : candidate
                        )
                      });
                      void updatePhotoRoomTag(photo.id, roomTag);
                    }}
                    options={[...ROOM_TAGS]}
                    value={photo.roomTag}
                  />
                </View>
                <View style={styles.rowButtons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void reorderPhoto(photo.id, "up")}
                    style={styles.secondaryButton}
                    testID="photo-move-up"
                  >
                    <Text style={styles.secondaryButtonText}>Move up</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void reorderPhoto(photo.id, "down")}
                    style={styles.secondaryButton}
                    testID="photo-move-down"
                  >
                    <Text style={styles.secondaryButtonText}>Move down</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
          {errors.photos ? <AlertText>{errors.photos}</AlertText> : null}
        </View>
      ) : null}

      {contentStep === 5 ? (
        <View style={styles.card} testID={`wizard-step-${step}`}>
          <SectionTitle
            title="Floor plan"
            body="Upload one image and review the default Living zone overlay."
          />
          <FilePicker onFiles={(files) => files[0] && void uploadFloorPlan(files[0])} testID="floorplan-file-input" />
          <View style={styles.floorPlanBox}>
            {draft.floorPlanUrl ? (
              <Image
                accessibilityLabel="Uploaded floor plan"
                alt="Uploaded floor plan"
                resizeMode="contain"
                source={{ uri: draft.floorPlanUrl }}
                style={styles.floorPlanImage}
              />
            ) : (
              <Text style={styles.placeholderText}>No floor plan uploaded yet.</Text>
            )}
            <Text style={styles.zoneBadge}>Living zone overlay</Text>
          </View>
          {errors.floorPlan ? <AlertText>{errors.floorPlan}</AlertText> : null}
        </View>
      ) : null}

      {contentStep === 6 ? (
        <View style={styles.card} testID={`wizard-step-${step}`}>
          <SectionTitle title="Rental terms" />
          <View style={styles.formGrid}>
            <LabeledInput
              label="Listing title"
              onChangeText={(title) => dispatch({ type: "patch", patch: { title } })}
              testID="rental-title"
              value={draft.title}
            />
            <LabeledInput
              inputMode="numeric"
              label="Monthly rent (SGD)"
              onChangeText={(monthlyRent) =>
                dispatch({ type: "patch", patch: { monthlyRent } })
              }
              testID="rental-rent"
              value={draft.monthlyRent}
            />
            <LabeledInput
              inputMode="numeric"
              label="Lease months"
              onChangeText={(leaseMonths) =>
                dispatch({ type: "patch", patch: { leaseMonths } })
              }
              testID="rental-lease"
              value={draft.leaseMonths}
            />
            <LabeledInput
              label="Available from"
              onChangeText={(availableFrom) =>
                dispatch({ type: "patch", patch: { availableFrom } })
              }
              placeholder="YYYY-MM-DD"
              testID="rental-available"
              value={draft.availableFrom}
            />
            <SelectInput
              label="Furnishing"
              onChange={(furnishing) => dispatch({ type: "patch", patch: { furnishing } })}
              options={["", ...FURNISHING]}
              testID="rental-furnishing"
              value={draft.furnishing}
            />
            <LabeledInput
              label="Description"
              multiline
              onChangeText={(description) =>
                dispatch({ type: "patch", patch: { description } })
              }
              testID="rental-description"
              value={draft.description}
            />
          </View>
          {errors.monthlyRent ? <AlertText>{errors.monthlyRent}</AlertText> : null}
        </View>
      ) : null}

      {contentStep === 7 ? (
        <View style={styles.card} testID={`wizard-step-${step}`}>
          <SectionTitle title="Review" />
          <View style={styles.reviewGrid}>
            <ReviewRow label="Title" value={draft.title} />
            <ReviewRow label="Address" value={`${draft.block} ${draft.street} ${draft.postal}`} />
            <ReviewRow
              label="Flat"
              value={`${draft.flatType || "—"} · ${draft.floorAreaSqft || "—"} sqft · ${draft.floorLevelBand || "—"}`}
            />
            <ReviewRow label="Photos" value={`${draft.photos.length} uploaded`} />
            <ReviewRow
              label="Floor plan"
              value={draft.floorPlanKey ? "Uploaded with zone overlay" : "Optional not uploaded"}
            />
            <ReviewRow
              label="Rent"
              value={`S$${draft.monthlyRent || "—"} · ${draft.leaseMonths} months · ${draft.furnishing || "—"}`}
            />
          </View>
          {missingFields.length > 0 ? (
            <View style={styles.missingBox}>
              <Text style={styles.missingTitle}>Missing fields</Text>
              {missingFields.map((field) => (
                <Text key={field} style={styles.missingText}>
                  • {field}
                </Text>
              ))}
            </View>
          ) : null}
          {errors.publish ? <AlertText>{errors.publish}</AlertText> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isBusy || missingFields.length > 0}
            onPress={() => void publish()}
            style={[
              styles.primaryButton,
              isBusy || missingFields.length > 0 ? styles.disabledButton : null
            ]}
            testID="wizard-publish"
          >
            <Text style={styles.primaryButtonText}>
              {isEdit && draft.status === "published"
                ? "Save changes"
                : isBusy
                  ? "Publishing…"
                  : "Publish"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.wizardNav}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy || step === 1}
          onPress={() => goToStep(step - 1)}
          style={[styles.secondaryButton, step === 1 ? styles.disabledButton : null]}
          testID="wizard-back"
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        {step < totalSteps ? (
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void next()}
            style={[styles.primaryButton, isBusy ? styles.disabledButton : null]}
            testID="wizard-next"
          >
            <Text style={styles.primaryButtonText}>{isBusy ? "Saving…" : "Next"}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SectionTitle({ body, title }: { body?: string; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {body ? <Text style={styles.sectionBody}>{body}</Text> : null}
    </View>
  );
}

function AlertText({ children }: { children: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.errorText}>
      {children}
    </Text>
  );
}

function LabeledInput({
  inputMode,
  label,
  multiline,
  onChangeText,
  placeholder,
  testID,
  value
}: {
  inputMode?: "numeric";
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        inputMode={inputMode}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={[styles.input, multiline ? styles.multilineInput : null]}
        testID={testID}
        value={value}
      />
    </View>
  );
}

function ClientPicker({
  clients,
  onSelect,
  selectedClientId
}: {
  clients: SellerClient[];
  onSelect: (ownerUserId: string) => void;
  selectedClientId: string;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.field} testID="client-picker">
        <Text style={styles.label}>Prior mandate clients</Text>
        {React.createElement(
          "select",
          {
            "aria-label": "Prior mandate clients",
            "data-testid": "client-picker",
            onChange: (event: { currentTarget: { value: string } }) =>
              onSelect(event.currentTarget.value),
            style: webSelectStyle,
            value: selectedClientId
          },
          [
            React.createElement(
              "option",
              { key: "empty", value: "" },
              clients.length > 0 ? "Select a seller" : "No sellers found"
            ),
            ...clients.map((client) =>
              React.createElement(
                "option",
                { key: client.id, value: client.id },
                `${client.email} · ${client.phone ?? "no phone"}`
              )
            )
          ]
        )}
      </View>
    );
  }

  return (
    <View style={styles.field} testID="client-picker">
      <Text style={styles.label}>Prior mandate clients</Text>
      <View style={styles.suggestions}>
        {clients.map((client) => (
          <Pressable
            accessibilityRole="button"
            key={client.id}
            onPress={() => onSelect(client.id)}
            style={styles.suggestionButton}
          >
            <Text style={styles.suggestionTitle}>{client.email}</Text>
            <Text style={styles.suggestionBody}>{client.phone ?? "No phone"}</Text>
          </Pressable>
        ))}
        {clients.length === 0 ? (
          <Text style={styles.placeholderText}>No sellers found</Text>
        ) : null}
      </View>
    </View>
  );
}

function SelectInput({
  label,
  onChange,
  options,
  testID,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  testID?: string;
  value: string;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.field} testID={testID}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement(
          "select",
          {
            "aria-label": label,
            "data-testid": testID,
            onChange: (event: { currentTarget: { value: string } }) =>
              onChange(event.currentTarget.value),
            style: webSelectStyle,
            value
          },
          options.map((option) =>
            React.createElement(
              "option",
              { key: option || "empty", value: option },
              option || `Select ${label.toLowerCase()}`
            )
          )
        )}
      </View>
    );
  }

  return (
    <View style={styles.field} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectButtons}>
        {options
          .filter(Boolean)
          .map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onChange(option)}
              style={[
                styles.optionPill,
                value === option ? styles.optionPillSelected : null
              ]}
            >
              <Text
                style={[
                  styles.optionPillText,
                  value === option ? styles.optionPillTextSelected : null
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
      </View>
    </View>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readOnlyBox}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value || "—"}</Text>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value || "—"}</Text>
    </View>
  );
}

function FilePicker({
  multiple,
  onFiles,
  testID
}: {
  multiple?: boolean;
  onFiles: (files: UploadFile[]) => void;
  testID: string;
}) {
  async function pickNativeImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: Boolean(multiple),
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9
    });
    if (result.canceled) {
      return;
    }
    const files = await Promise.all(
      result.assets.map(async (asset, index): Promise<UploadFile> => {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        return {
          blob,
          localUrl: asset.uri,
          name: asset.fileName ?? `listing-photo-${index + 1}.jpg`,
          size: blob.size,
          type: normalizeImageType(asset.mimeType)
        };
      })
    );
    onFiles(files);
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.field} testID={testID}>
        <Text style={styles.label}>Choose image file{multiple ? "s" : ""}</Text>
        {React.createElement("input", {
          accept: "image/*",
          "data-testid": testID,
          multiple,
          onChange: (event: { currentTarget: { files: FileList | null; value: string } }) => {
            const fileList = event.currentTarget.files;
            if (fileList) {
              onFiles(
                Array.from(fileList).map((file) => ({
                  blob: file,
                  localUrl: URL.createObjectURL(file),
                  name: file.name,
                  size: file.size,
                  type: normalizeImageType(file.type)
                }))
              );
            }
            event.currentTarget.value = "";
          },
          style: webFileStyle,
          type: "file"
        })}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void pickNativeImages()}
      style={styles.secondaryButton}
      testID={testID}
    >
      <Text style={styles.secondaryButtonText}>Choose image file{multiple ? "s" : ""}</Text>
    </Pressable>
  );
}

const webSelectStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  color: "#020617",
  fontSize: 16,
  padding: "12px 14px"
};

const webFileStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  color: "#020617",
  fontSize: 16,
  padding: "12px 14px"
};

const styles = StyleSheet.create({
  brand: {
    color: "#0f766e",
    fontSize: 22,
    fontWeight: "800"
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.10)",
    gap: 18,
    padding: 24
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  choiceBody: {
    color: "#475569",
    fontSize: 14,
    marginTop: 8
  },
  choiceCard: {
    borderColor: "#e2e8f0",
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: 190,
    flexGrow: 1,
    padding: 20
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  choiceSelected: {
    backgroundColor: "#f0fdfa",
    borderColor: "#0f766e"
  },
  choiceTitle: {
    color: "#020617",
    fontSize: 18,
    fontWeight: "800"
  },
  container: {
    backgroundColor: "#f8fafc",
    gap: 24,
    minHeight: "100%",
    padding: 24
  },
  disabledButton: {
    opacity: 0.55
  },
  disabledChoice: {
    opacity: 0.55
  },
  errorText: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 14,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "700",
    padding: 12
  },
  field: {
    flexBasis: 260,
    flexGrow: 1,
    gap: 8
  },
  floorPlanBox: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 12,
    minHeight: 260,
    padding: 16
  },
  floorPlanImage: {
    height: 220,
    width: "100%"
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  header: {
    gap: 8
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
  kicker: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  },
  missingBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 16,
    gap: 4,
    padding: 16
  },
  missingText: {
    color: "#991b1b",
    fontSize: 14
  },
  missingTitle: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "800"
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  optionPill: {
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  optionPillSelected: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  optionPillText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700"
  },
  optionPillTextSelected: {
    color: "#ffffff"
  },
  photo: {
    backgroundColor: "#ccfbf1",
    borderRadius: 16,
    height: 150,
    width: "100%"
  },
  photoCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: 240,
    flexGrow: 1,
    gap: 12,
    padding: 12
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  placeholderText: {
    color: "#64748b",
    fontSize: 14
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 13
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  readOnlyBox: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 14,
    borderWidth: 1,
    flexBasis: 130,
    flexGrow: 1,
    gap: 4,
    padding: 12
  },
  readOnlyLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  readOnlyValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700"
  },
  reviewGrid: {
    gap: 10
  },
  reviewLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700"
  },
  reviewRow: {
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
    gap: 3,
    paddingBottom: 10
  },
  reviewValue: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700"
  },
  rowButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 11
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800"
  },
  sectionBody: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22
  },
  sectionHeading: {
    color: "#020617",
    fontSize: 24,
    fontWeight: "800"
  },
  sectionTitle: {
    gap: 8
  },
  selectButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  status: {
    color: "#475569",
    fontSize: 16
  },
  subtitle: {
    color: "#64748b",
    fontSize: 16
  },
  suggestionBody: {
    color: "#475569",
    fontSize: 13,
    marginTop: 4
  },
  suggestionButton: {
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    padding: 14
  },
  suggestionTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800"
  },
  suggestions: {
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  title: {
    color: "#020617",
    fontSize: 36,
    fontWeight: "800"
  },
  wizardNav: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  zoneBadge: {
    backgroundColor: "#ccfbf1",
    borderRadius: 999,
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 8
  }
});
