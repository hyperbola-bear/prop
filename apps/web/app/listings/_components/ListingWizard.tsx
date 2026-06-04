"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

const FLAT_TYPES = ["1-room", "2-room", "3-room", "4-room", "5-room", "Executive"] as const;
const FLOOR_BANDS = ["low", "mid", "high"] as const;
const FURNISHING = ["Unfurnished", "Partial", "Fully"] as const;
const ROOM_TAGS = ["Living", "Kitchen", "Bedroom", "Bathroom", "Balcony"] as const;

type Suggestion = {
  SEARCHVAL: string;
  BLK_NO: string;
  ROAD_NAME: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
};

export type WizardPhoto = {
  id: string;
  url: string;
  roomTag: string;
  sortOrder: number;
};

export type ListingDraft = {
  id?: string;
  status?: string;
  propertyType: "hdb" | "";
  title: string;
  description: string;
  ownerUserId: string;
  freeformSellerEmail: string;
  mandateVia: "agent_mandate" | "agent_no_mandate" | "";
  block: string;
  street: string;
  postal: string;
  lat: string;
  lng: string;
  addressId: string | undefined;
  blockId: string | undefined;
  flatType: string;
  floorLevelBand: string;
  floorAreaSqft: string;
  monthlyRent: string;
  leaseMonths: string;
  availableFrom: string;
  furnishing: string;
  floorPlanUrl: string;
  floorPlanKey: string;
  photos: WizardPhoto[];
};

type ClientUser = {
  email: string;
  roles: string[];
};

type SellerClient = {
  id: string;
  email: string;
  phone: string;
  name: string;
};

type WizardProps = {
  user: ClientUser;
  initialListingId?: string;
};

type Action =
  | { type: "patch"; patch: Partial<ListingDraft> }
  | { type: "setPhotos"; photos: WizardPhoto[] }
  | { type: "reset"; draft: ListingDraft };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankDraft(): ListingDraft {
  return {
    propertyType: "",
    title: "HDB rental",
    description: "",
    ownerUserId: "",
    freeformSellerEmail: "",
    mandateVia: "",
    block: "",
    street: "",
    postal: "",
    lat: "",
    lng: "",
    addressId: undefined,
    blockId: undefined,
    flatType: "",
    floorLevelBand: "",
    floorAreaSqft: "",
    monthlyRent: "",
    leaseMonths: "12",
    availableFrom: todayIso(),
    furnishing: "",
    floorPlanUrl: "",
    floorPlanKey: "",
    photos: []
  };
}

function reducer(state: ListingDraft, action: Action): ListingDraft {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "setPhotos":
      return { ...state, photos: action.photos };
    case "reset":
      return action.draft;
  }
}

function fallbackSuggestion(input: string): Suggestion {
  return {
    SEARCHVAL: input,
    BLK_NO: input.match(/\d+/)?.[0] ?? "1",
    ROAD_NAME: input.toUpperCase(),
    BUILDING: "HDB block",
    ADDRESS: `${input}, Singapore 310001`,
    POSTAL: "310001",
    LATITUDE: "1.3343",
    LONGITUDE: "103.8484"
  };
}

function dollarsToCents(value: string): number {
  return Math.round(Number(value || "0") * 100);
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: unknown }).error === "string"
        ? ((payload as { error: string }).error)
        : ((payload as { error?: { message?: string } }).error?.message ?? `Request failed (${response.status})`)
    );
  }
  return payload;
}

type PresignUploadResponse = {
  fields: Record<string, string>;
  headers?: Record<string, string>;
  key: string;
  method?: "POST" | "PUT";
  url: string;
};

async function uploadToPresignedUrl(
  presign: PresignUploadResponse,
  file: File,
  contentType: string
): Promise<Response> {
  if (presign.method === "POST") {
    const form = new FormData();
    for (const [field, value] of Object.entries(presign.fields)) {
      form.append(field, value);
    }
    form.append("file", file);
    return fetch(presign.url, { method: "POST", body: form });
  }

  return fetch(presign.url, {
    method: "PUT",
    body: file,
    headers: presign.headers ?? { "Content-Type": contentType }
  });
}

export function missingFieldsForDraft(draft: ListingDraft): string[] {
  const missing: string[] = [];
  if (!draft.addressId || !draft.blockId) missing.push("Address");
  if (!draft.flatType) missing.push("Flat type");
  if (!draft.floorAreaSqft) missing.push("Floor area");
  if (draft.photos.length < 3) missing.push("At least 3 photos required");
  if (!draft.monthlyRent || Number(draft.monthlyRent) < 100 || Number(draft.monthlyRent) > 50000) {
    missing.push("Monthly rent must be between S$100 and S$50,000");
  }
  if (!draft.leaseMonths) missing.push("Lease months");
  if (!draft.availableFrom) missing.push("Available from date");
  if (!draft.furnishing) missing.push("Furnishing");
  return missing;
}

function buildRentalTermsPatch(draft: ListingDraft): Record<string, unknown> | null {
  const rent = Number(draft.monthlyRent);
  if (Number.isNaN(rent) || rent < 100 || rent > 50000) {
    return null;
  }

  const patch: Record<string, unknown> = {
    title: draft.title,
    description: draft.description,
    priceSgd: dollarsToCents(draft.monthlyRent)
  };
  const leaseMonths = Number(draft.leaseMonths);
  if (Number.isInteger(leaseMonths) && leaseMonths >= 1 && leaseMonths <= 36) {
    patch.leaseMonths = leaseMonths;
  }
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(draft.availableFrom)) {
    patch.availableFrom = draft.availableFrom;
  }
  if ((FURNISHING as readonly string[]).includes(draft.furnishing)) {
    patch.furnishing = draft.furnishing;
  }
  return patch;
}

export function ListingWizardReview({
  draft,
  errors,
  isBusy,
  isEdit,
  missingFields,
  onPublish
}: {
  draft: ListingDraft;
  errors: Record<string, string>;
  isBusy: boolean;
  isEdit: boolean;
  missingFields: string[];
  onPublish: () => void;
}) {
  return (
    <section data-testid="wizard-step-7" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-950">Review</h2>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold">Title</dt><dd>{draft.title}</dd></div>
        <div><dt className="font-semibold">Address</dt><dd>{draft.block} {draft.street} {draft.postal}</dd></div>
        <div><dt className="font-semibold">Flat</dt><dd>{draft.flatType} · {draft.floorAreaSqft} sqft · {draft.floorLevelBand}</dd></div>
        <div><dt className="font-semibold">Photos</dt><dd>{draft.photos.length} uploaded</dd></div>
        <div><dt className="font-semibold">Floor plan</dt><dd>{draft.floorPlanKey ? "Uploaded with zone overlay" : "Optional not uploaded"}</dd></div>
        <div><dt className="font-semibold">Rent</dt><dd>S${draft.monthlyRent || "—"} · {draft.leaseMonths} months · {draft.furnishing || "—"}</dd></div>
      </dl>
      {missingFields.length > 0 ? (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">Missing fields</p>
          <ul data-testid="wizard-missing-fields" className="mt-2 list-disc pl-5">
            {missingFields.map((field) => <li key={field}>{field}</li>)}
          </ul>
        </div>
      ) : null}
      {errors.publish ? <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{errors.publish}</p> : null}
      <button
        data-testid="wizard-publish"
        type="button"
        disabled={isBusy || missingFields.length > 0}
        onClick={onPublish}
        className="mt-6 rounded-full bg-proppy-primary px-6 py-3 font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isEdit && draft.status === "published" ? "Save changes" : isBusy ? "Publishing…" : "Publish"}
      </button>
    </section>
  );
}

export function ListingWizard({ user, initialListingId }: WizardProps) {
  const isAgent = user.roles.includes("agent");
  const isEdit = Boolean(initialListingId);
  const [draft, dispatch] = useReducer(reducer, blankDraft());
  const [step, setStep] = useState(isAgent && !isEdit ? 0 : 1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [addressQuery, setAddressQuery] = useState("");
  const [clients, setClients] = useState<SellerClient[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);

  const storageKey = draft.id ? `proppy-listing-wizard-${draft.id}` : "";

  useEffect(() => {
    if (!initialListingId) {
      return;
    }
    void (async () => {
      const payload = await jsonFetch<{
        id: string;
        status: string;
        title: string;
        description: string | null;
        ownerUserId: string;
        agentUserId: string | null;
        representedVia: string;
        priceSgd: number;
        block: string | null;
        street: string | null;
        postal: string | null;
        latitude: string | null;
        longitude: string | null;
        addressId: string | null;
        blockId: string | null;
        flatType: string | null;
        floorLevelBand: string | null;
        floorAreaSqft: number | null;
        leaseMonths: number | null;
        availableFrom: string | null;
        furnishing: string | null;
        photos: WizardPhoto[];
        floorPlan: { objectPath: string; url: string } | null;
      }>(`/api/me/listings/${initialListingId}`);
      dispatch({
        type: "reset",
        draft: {
          propertyType: "hdb",
          id: payload.id,
          status: payload.status,
          title: payload.title,
          description: payload.description ?? "",
          ownerUserId: payload.ownerUserId,
          freeformSellerEmail: "",
          mandateVia:
            payload.representedVia === "agent_mandate" || payload.representedVia === "agent_no_mandate"
              ? payload.representedVia
              : "",
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
          availableFrom: payload.availableFrom ?? todayIso(),
          furnishing: payload.furnishing ?? "",
          floorPlanUrl: payload.floorPlan?.url ?? "",
          floorPlanKey: payload.floorPlan?.objectPath ?? "",
          photos: payload.photos ?? []
        }
      });
    })().catch((error) => setErrors({ load: error instanceof Error ? error.message : "Failed to load listing" }));
  }, [initialListingId]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    const saved = localStorage.getItem(storageKey);
    if (saved && !initialListingId) {
      try {
        dispatch({ type: "reset", draft: JSON.parse(saved) as ListingDraft });
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey, initialListingId]);

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    }
  }, [draft, storageKey]);

  useEffect(() => {
    if (!isAgent) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void jsonFetch<{ items: SellerClient[] }>(`/api/me/clients?q=${encodeURIComponent(clientQuery)}`)
        .then((payload) => setClients(payload.items))
        .catch(() => setClients([]));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [clientQuery, isAgent]);

  useEffect(() => {
    if (step !== 2 || addressQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      void jsonFetch<Suggestion[]>(`/api/onemap/search?q=${encodeURIComponent(addressQuery)}`)
        .then((payload) => setSuggestions(payload.length > 0 ? payload : [fallbackSuggestion(addressQuery)]))
        .catch(() => setSuggestions([fallbackSuggestion(addressQuery)]));
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [addressQuery, step]);

  const missingFields = useMemo(() => missingFieldsForDraft(draft), [draft]);

  const ensureDraft = useCallback(async () => {
    if (draft.id) {
      return draft.id;
    }
    const body: Record<string, unknown> = {
      title: draft.title || "HDB rental",
      description: draft.description,
      priceSgd: dollarsToCents(draft.monthlyRent)
    };
    if (isAgent && draft.ownerUserId) {
      body.ownerUserId = draft.ownerUserId;
      body.mandateVia = draft.mandateVia || "agent_mandate";
    }
    const created = await jsonFetch<{ id: string; status: string }>("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    dispatch({ type: "patch", patch: { id: created.id, status: created.status } });
    return created.id;
  }, [draft.description, draft.id, draft.mandateVia, draft.monthlyRent, draft.ownerUserId, draft.title, isAgent]);

  async function patchListing(patch: Record<string, unknown> = {}) {
    const id = await ensureDraft();
    await jsonFetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    setLastSaved(new Date().toLocaleTimeString("en-SG"));
  }

  async function resolveAddress(suggestion: Suggestion) {
    setIsBusy(true);
    setErrors({});
    try {
      const resolved = await jsonFetch<{ addressId: string; blockId: string; town: string }>("/api/addresses/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block: suggestion.BLK_NO || fallbackSuggestion(addressQuery).BLK_NO,
          street: suggestion.ROAD_NAME || addressQuery,
          postal: suggestion.POSTAL,
          building: suggestion.BUILDING,
          address: suggestion.ADDRESS,
          lat: suggestion.LATITUDE,
          lng: suggestion.LONGITUDE
        })
      });
      const patch = {
        block: suggestion.BLK_NO || fallbackSuggestion(addressQuery).BLK_NO,
        street: suggestion.ROAD_NAME || addressQuery,
        postal: suggestion.POSTAL,
        lat: suggestion.LATITUDE,
        lng: suggestion.LONGITUDE,
        addressId: resolved.addressId,
        blockId: resolved.blockId
      };
      dispatch({ type: "patch", patch });
      await patchListing({ addressId: resolved.addressId, blockId: resolved.blockId });
      setStep(3);
    } catch (error) {
      setErrors({ address: error instanceof Error ? error.message : "Address selection failed" });
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    setIsBusy(true);
    setErrors({});
    try {
      const listingId = await ensureDraft();
      const nextPhotos = [...draft.photos];
      for (const file of Array.from(files)) {
        const contentType = file.type || "image/jpeg";
        const presign = await jsonFetch<PresignUploadResponse>("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType,
            fileSize: file.size,
            scope: "listing-photo",
            listingId
          })
        });
        const put = await uploadToPresignedUrl(presign, file, contentType);
        if (!put.ok) {
          throw new Error(`Upload failed (${put.status})`);
        }
        const photo = await jsonFetch<{ id: string; sortOrder: number }>(`/api/listings/${listingId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: presign.key,
            roomTag: "Living",
            altText: file.name || "Listing photo"
          })
        });
        nextPhotos.push({
          id: photo.id,
          url: URL.createObjectURL(file),
          roomTag: "Living",
          sortOrder: photo.sortOrder
        });
      }
      dispatch({ type: "setPhotos", photos: nextPhotos });
    } catch (error) {
      setErrors({ photos: error instanceof Error ? error.message : "Photo upload failed" });
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadFloorPlan(file: File | null) {
    if (!file) {
      return;
    }
    setIsBusy(true);
    setErrors({});
    try {
      const listingId = await ensureDraft();
      const contentType = file.type || "image/jpeg";
      const presign = await jsonFetch<PresignUploadResponse>("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          fileSize: file.size,
          scope: "listing-floor-plan",
          listingId
        })
      });
      const put = await uploadToPresignedUrl(presign, file, contentType);
      if (!put.ok) {
        throw new Error(`Floor plan upload failed (${put.status})`);
      }
      await jsonFetch(`/api/listings/${listingId}/floor-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: presign.key,
          zone: { roomTag: "Living" }
        })
      });
      dispatch({ type: "patch", patch: { floorPlanUrl: URL.createObjectURL(file), floorPlanKey: presign.key } });
    } catch (error) {
      setErrors({ floorPlan: error instanceof Error ? error.message : "Floor plan upload failed" });
    } finally {
      setIsBusy(false);
    }
  }

  async function reorderPhotos(targetPhotoId: string) {
    if (!draggedPhotoId || draggedPhotoId === targetPhotoId) {
      return;
    }
    const draggedIndex = draft.photos.findIndex((photo) => photo.id === draggedPhotoId);
    const targetIndex = draft.photos.findIndex((photo) => photo.id === targetPhotoId);
    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }
    const reordered = [...draft.photos];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved!);
    dispatch({ type: "setPhotos", photos: reordered });
    setDraggedPhotoId(null);
    if (draft.id) {
      await jsonFetch(`/api/listings/${draft.id}/photos/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((photo) => photo.id) })
      });
    }
  }

  async function updatePhotoRoomTag(photoId: string, roomTag: string) {
    if (!draft.id) {
      return;
    }
    try {
      await jsonFetch(`/api/listings/${draft.id}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_tag: roomTag })
      });
      setLastSaved(new Date().toLocaleTimeString("en-SG"));
    } catch (error) {
      setErrors({
        photos: error instanceof Error ? error.message : "Room tag update failed"
      });
    }
  }

  async function next() {
    setErrors({});
    if (step === 0) {
      if (!draft.ownerUserId && draft.freeformSellerEmail) {
        const client = await jsonFetch<SellerClient>("/api/me/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: draft.freeformSellerEmail })
        });
        dispatch({ type: "patch", patch: { ownerUserId: client.id, mandateVia: "agent_no_mandate" } });
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (draft.propertyType === "hdb") {
        await ensureDraft();
      }
    }
    if (step === 3) {
      const floorAreaSqft = Number(draft.floorAreaSqft);
      if (draft.flatType && Number.isFinite(floorAreaSqft) && floorAreaSqft > 0) {
        await patchListing({
          flatType: draft.flatType,
          floorLevelBand: draft.floorLevelBand || null,
          floorAreaSqft,
          blockId: draft.blockId
        });
      }
    }
    if (step === 6) {
      const rentalTermsPatch = buildRentalTermsPatch(draft);
      if (rentalTermsPatch) {
        await patchListing(rentalTermsPatch);
      }
    }
    setStep(Math.min(7, step + 1));
  }

  function back() {
    setErrors({});
    if (step === 1 && isAgent && !isEdit) {
      setStep(0);
      return;
    }
    setStep(Math.max(1, step - 1));
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
        title: draft.title,
        description: draft.description,
        priceSgd: dollarsToCents(draft.monthlyRent),
        leaseMonths: Number(draft.leaseMonths),
        availableFrom: draft.availableFrom,
        furnishing: draft.furnishing,
        flatType: draft.flatType,
        floorLevelBand: draft.floorLevelBand || null,
        floorAreaSqft: Number(draft.floorAreaSqft),
        addressId: draft.addressId,
        blockId: draft.blockId
      });
      if (isEdit && draft.status === "published") {
        window.location.href = "/dashboard/listings";
        return;
      }
      await jsonFetch(`/api/listings/${id}/publish`, { method: "POST" });
      localStorage.removeItem(`proppy-listing-wizard-${id}`);
      window.location.href = `/listings/${id}`;
    } catch (error) {
      setErrors({ publish: error instanceof Error ? error.message : "Publish failed" });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
          {isEdit ? "Edit listing" : "Create listing"}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
          HDB rental listing wizard
        </h1>
        <p className="mt-3 text-slate-600">
          Step {step === 0 ? "Acting on behalf of" : step} of 7
          {lastSaved ? <span className="ml-2">· Saved at {lastSaved}</span> : null}
        </p>
      </div>

      {errors.load ? <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{errors.load}</p> : null}

      {step === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Acting on behalf of</h2>
          <p className="mt-2 text-slate-600">
            Select a seller from prior mandate clients, search by email/phone, or enter a freeform seller email.
          </p>
          <label htmlFor="client-search" className="mt-6 block text-sm font-semibold text-slate-700">
            Search sellers
          </label>
          <input
            id="client-search"
            value={clientQuery}
            onChange={(event) => setClientQuery(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            placeholder="landlord1@proppy.test or +65…"
          />
          <label htmlFor="client-picker" className="mt-4 block text-sm font-semibold text-slate-700">
            Prior mandate clients
          </label>
          <select
            id="client-picker"
            value={draft.ownerUserId}
            onChange={(event) => dispatch({ type: "patch", patch: { ownerUserId: event.target.value, mandateVia: "agent_mandate" } })}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          >
            <option value="">Select a seller</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.email} · {client.phone}
              </option>
            ))}
          </select>
          <label htmlFor="freeform-seller" className="mt-4 block text-sm font-semibold text-slate-700">
            Freeform seller email
          </label>
          <input
            id="freeform-seller"
            type="email"
            value={draft.freeformSellerEmail}
            onChange={(event) => dispatch({ type: "patch", patch: { freeformSellerEmail: event.target.value, mandateVia: event.target.value ? "agent_no_mandate" : "" } })}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            placeholder="seller@example.com"
          />
          {errors.ownerUserId ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{errors.ownerUserId}</p> : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section data-testid="wizard-step-1" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Property type</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => dispatch({ type: "patch", patch: { propertyType: "hdb" } })}
              className={`rounded-2xl border px-5 py-6 text-left ${draft.propertyType === "hdb" ? "border-proppy-primary bg-teal-50" : "border-slate-200"}`}
            >
              <span className="block text-lg font-bold">HDB</span>
              <span className="mt-2 block text-sm text-slate-600">Available now for rentals.</span>
            </button>
            {["Condo", "Landed"].map((label) => (
              <button key={label} type="button" disabled className="rounded-2xl border border-slate-200 px-5 py-6 text-left opacity-60">
                <span className="block text-lg font-bold">{label}</span>
                <span className="mt-2 block text-sm text-slate-600">Coming soon</span>
              </button>
            ))}
          </div>
          {errors.propertyType ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{errors.propertyType}</p> : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section data-testid="wizard-step-2" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Address</h2>
          <label htmlFor="onemap-search" className="mt-6 block text-sm font-semibold text-slate-700">
            OneMap autocomplete
          </label>
          <input
            id="onemap-search"
            value={addressQuery}
            onChange={(event) => setAddressQuery(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
            placeholder="Toa Payoh Lor 1"
          />
          {suggestions.length > 0 ? (
            <ul className="mt-3 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.SEARCHVAL}-${suggestion.POSTAL}`}>
                  <button
                    type="button"
                    onClick={() => void resolveAddress(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-teal-50"
                  >
                    <span className="block font-semibold">{suggestion.SEARCHVAL}</span>
                    <span className="block text-sm text-slate-600">{suggestion.ADDRESS}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6 grid gap-4 sm:grid-cols-5">
            {[
              ["Block", draft.block],
              ["Street", draft.street],
              ["Postal", draft.postal],
              ["Lat", draft.lat],
              ["Lng", draft.lng]
            ].map(([label, value]) => (
              <label key={label} className="text-sm font-semibold text-slate-700">
                {label}
                <input readOnly value={value} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" />
              </label>
            ))}
          </div>
          {errors.address ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{errors.address}</p> : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section data-testid="wizard-step-3" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Unit details</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-700">
              Flat type
              <select value={draft.flatType} onChange={(event) => dispatch({ type: "patch", patch: { flatType: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3">
                <option value="">Select flat type</option>
                {FLAT_TYPES.map((flatType) => <option key={flatType} value={flatType}>{flatType}</option>)}
              </select>
              {errors.flatType ? <span role="alert" className="mt-2 block text-sm text-red-700">{errors.flatType}</span> : null}
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Floor level band
              <select value={draft.floorLevelBand} onChange={(event) => dispatch({ type: "patch", patch: { floorLevelBand: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3">
                <option value="">Select band</option>
                {FLOOR_BANDS.map((band) => <option key={band} value={band}>{band}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Floor area (sqft)
              <input type="number" required value={draft.floorAreaSqft} onChange={(event) => dispatch({ type: "patch", patch: { floorAreaSqft: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
              {errors.floorAreaSqft ? <span role="alert" className="mt-2 block text-sm text-red-700">{errors.floorAreaSqft}</span> : null}
            </label>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section data-testid="wizard-step-4" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Photos</h2>
          <p className="mt-2 text-slate-600">Upload at least 3 photos. Drag photos to reorder them.</p>
          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Upload listing photos
            <input type="file" accept="image/*" multiple onChange={(event) => void uploadFiles(event.target.files)} className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {draft.photos.map((photo, index) => (
              <div
                key={photo.id}
                draggable
                onDragStart={() => setDraggedPhotoId(photo.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void reorderPhotos(photo.id)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <img src={photo.url} alt={`Listing photo ${index + 1}`} className="h-36 w-full rounded-xl object-cover" />
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Room tag
                  <select
                    value={photo.roomTag}
                    onChange={(event) => {
                      const roomTag = event.target.value;
                      const photos = draft.photos.map((candidate) => candidate.id === photo.id ? { ...candidate, roomTag } : candidate);
                      dispatch({ type: "setPhotos", photos });
                      void updatePhotoRoomTag(photo.id, roomTag);
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {ROOM_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
              </div>
            ))}
          </div>
          {errors.photos ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{errors.photos}</p> : null}
        </section>
      ) : null}

      {step === 5 ? (
        <section data-testid="wizard-step-5" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Floor plan</h2>
          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Upload floor plan image
            <input type="file" accept="image/*" onChange={(event) => void uploadFloorPlan(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4">
            <p className="font-semibold text-slate-800">Tag zones</p>
            <div className="relative mt-3 h-72 overflow-hidden rounded-xl bg-slate-100">
              {draft.floorPlanUrl ? <img src={draft.floorPlanUrl} alt="Uploaded floor plan" className="h-full w-full object-contain" /> : null}
              <svg aria-label="Zone tag UI overlay" className="absolute inset-0 h-full w-full">
                <polygon points="30,30 230,30 230,150 30,150" fill="rgba(15,118,110,0.25)" stroke="#0f766e" strokeWidth="3" />
                <text x="45" y="62" fill="#0f766e" fontWeight="700">Living</text>
              </svg>
            </div>
          </div>
          {errors.floorPlan ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{errors.floorPlan}</p> : null}
        </section>
      ) : null}

      {step === 6 ? (
        <section data-testid="wizard-step-6" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Rental terms</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Listing title
              <input value={draft.title} onChange={(event) => dispatch({ type: "patch", patch: { title: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Monthly rent (SGD)
              <input data-testid="rental-rent" type="number" min={100} max={50000} value={draft.monthlyRent} onChange={(event) => dispatch({ type: "patch", patch: { monthlyRent: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
              {errors.monthlyRent ? <span role="alert" className="mt-2 block text-sm text-red-700">{errors.monthlyRent}</span> : null}
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Lease months
              <input data-testid="rental-lease" type="number" min={1} max={36} value={draft.leaseMonths} onChange={(event) => dispatch({ type: "patch", patch: { leaseMonths: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Available from
              <input data-testid="rental-available" type="date" value={draft.availableFrom} onChange={(event) => dispatch({ type: "patch", patch: { availableFrom: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Furnishing
              <select data-testid="rental-furnishing" value={draft.furnishing} onChange={(event) => dispatch({ type: "patch", patch: { furnishing: event.target.value } })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3">
                <option value="">Select furnishing</option>
                {FURNISHING.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
              Description
              <textarea value={draft.description} onChange={(event) => dispatch({ type: "patch", patch: { description: event.target.value } })} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3" />
            </label>
          </div>
        </section>
      ) : null}

      {step === 7 ? (
        <ListingWizardReview
          draft={draft}
          errors={errors}
          isBusy={isBusy}
          isEdit={isEdit}
          missingFields={missingFields}
          onPublish={() => void publish()}
        />
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <button
          data-testid="wizard-back"
          type="button"
          onClick={back}
          disabled={isBusy || (step === 1 && (!isAgent || isEdit))}
          className="rounded-full border border-slate-300 px-6 py-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
        {step < 7 ? (
          <button
            data-testid="wizard-next"
            type="button"
            onClick={() => void next()}
            disabled={isBusy}
            className="rounded-full bg-proppy-primary px-6 py-3 font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isBusy ? "Saving…" : "Next"}
          </button>
        ) : null}
      </div>
    </main>
  );
}
