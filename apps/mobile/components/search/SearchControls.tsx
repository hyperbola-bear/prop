import { useRouter, type Href } from "expo-router";
import { createElement, useMemo, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { mobileApiClient } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  FLAT_TYPES,
  FURNISHING_OPTIONS,
  HDB_TOWNS,
  MRT_OPTIONS,
  RADIUS_KM_OPTIONS,
  SORT_OPTIONS,
  savedQueryFromFilters,
  type SearchFilterKey,
  type SearchFilters
} from "../../lib/search-options";

type SearchControlsProps = {
  filters: SearchFilters;
  onApply: () => void;
  onChangeFilter: (key: SearchFilterKey, value: string) => void;
  onReset: () => void;
};

type SortAndViewControlsProps = {
  filters: SearchFilters;
  onImmediateChange: (filters: SearchFilters) => void;
};

type SelectOption = {
  label: string;
  value: string;
};

type WebChangeEvent = {
  target: {
    checked?: boolean;
    value: string;
  };
};

const townOptions = [
  { label: "Any town", value: "" },
  ...HDB_TOWNS.map((town) => ({ label: town, value: town }))
];
const flatTypeOptions = [
  { label: "Any flat type", value: "" },
  ...FLAT_TYPES.map((flatType) => ({ label: flatType, value: flatType }))
];
const bedroomOptions = [
  { label: "Any bedrooms", value: "" },
  { label: "1 bedroom", value: "1" },
  { label: "2 bedrooms", value: "2" },
  { label: "3 bedrooms", value: "3" },
  { label: "4 bedrooms", value: "4" }
];
const leaseOptions = [
  { label: "Any lease", value: "" },
  { label: "6+ months", value: "6" },
  { label: "12+ months", value: "12" },
  { label: "24+ months", value: "24" }
];
const furnishingOptions = [
  { label: "Any furnishing", value: "" },
  ...FURNISHING_OPTIONS.map((furnishing) => ({
    label: furnishing === "Fully" ? "Fully furnished" : furnishing,
    value: furnishing
  }))
];
const mrtOptions = [
  { label: "Any MRT", value: "" },
  ...MRT_OPTIONS.map((mrt) => ({ label: mrt, value: mrt }))
];
const radiusOptions = RADIUS_KM_OPTIONS.map((radius) => ({
  label: `${radius} km`,
  value: radius
}));

function FieldLabel({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function TextField({
  inputMode,
  label,
  onChangeText,
  placeholder,
  testID,
  value
}: {
  inputMode?: "numeric" | "text";
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
  value: string;
}) {
  return (
    <FieldLabel label={label}>
      <TextInput
        accessibilityLabel={label}
        inputMode={inputMode}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
        testID={testID}
        value={value}
      />
    </FieldLabel>
  );
}

function SelectField({
  label,
  onChange,
  options,
  testID,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  testID: string;
  value: string;
}) {
  if (Platform.OS === "web") {
    return (
      <FieldLabel label={label}>
        {createElement(
          "select",
          {
            "aria-label": label,
            "data-testid": testID,
            onChange: (event: WebChangeEvent) => onChange(event.target.value),
            style: webControlStyle,
            value
          },
          options.map((option) =>
            createElement(
              "option",
              { key: option.value || "empty", value: option.value },
              option.label
            )
          )
        )}
      </FieldLabel>
    );
  }

  return (
    <TextField
      label={label}
      onChangeText={onChange}
      placeholder={options.map((option) => option.value).filter(Boolean).join(", ")}
      testID={testID}
      value={value}
    />
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
  testID
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  testID: string;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.checkboxRow}>
        {createElement("input", {
          "aria-label": label,
          "data-testid": testID,
          checked,
          onChange: (event: WebChangeEvent) =>
            onChange(Boolean(event.target.checked)),
          style: webCheckboxStyle,
          type: "checkbox"
        })}
        <Text style={styles.checkboxText}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkboxRow}
      testID={testID}
    >
      <View style={[styles.checkboxBox, checked ? styles.checkboxBoxChecked : null]}>
        {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxText}>{label}</Text>
    </Pressable>
  );
}

export function FilterPanel({
  filters,
  onApply,
  onChangeFilter,
  onReset
}: SearchControlsProps) {
  return (
    <View style={styles.panel}>
      <TextField
        label="Keywords"
        onChangeText={(value) => onChangeFilter("q", value)}
        placeholder="balcony sunny"
        value={filters.q}
      />
      <SelectField
        label="Town"
        onChange={(value) => onChangeFilter("town", value)}
        options={townOptions}
        testID="filter-town"
        value={filters.town}
      />
      <SelectField
        label="Flat type"
        onChange={(value) => onChangeFilter("flat_type", value)}
        options={flatTypeOptions}
        testID="filter-flat-type"
        value={filters.flat_type}
      />
      <TextField
        inputMode="numeric"
        label="Min price (SGD)"
        onChangeText={(value) => onChangeFilter("price_min", value)}
        testID="filter-price-min"
        value={filters.price_min}
      />
      <TextField
        inputMode="numeric"
        label="Max price (SGD)"
        onChangeText={(value) => onChangeFilter("price_max", value)}
        testID="filter-price-max"
        value={filters.price_max}
      />
      <SelectField
        label="Bedrooms"
        onChange={(value) => onChangeFilter("bedrooms", value)}
        options={bedroomOptions}
        testID="filter-bedrooms"
        value={filters.bedrooms}
      />
      <SelectField
        label="Minimum lease"
        onChange={(value) => onChangeFilter("lease_min_months", value)}
        options={leaseOptions}
        testID="filter-lease-term"
        value={filters.lease_min_months}
      />
      <TextField
        label="Available from"
        onChangeText={(value) => onChangeFilter("available_from", value)}
        placeholder="2026-06-01"
        value={filters.available_from}
      />
      <SelectField
        label="Furnishing"
        onChange={(value) => onChangeFilter("furnishing", value)}
        options={furnishingOptions}
        testID="filter-furnishing"
        value={filters.furnishing}
      />
      <CheckboxField
        checked={filters.room_only === "true"}
        label="Room-only listings"
        onChange={(checked) => onChangeFilter("room_only", checked ? "true" : "")}
        testID="filter-room-only"
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onApply}
          style={styles.primaryButton}
          testID="filter-apply"
        >
          <Text style={styles.primaryButtonText}>Apply filters</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onReset}
          style={styles.secondaryButton}
          testID="filter-reset"
        >
          <Text style={styles.secondaryButtonText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RadiusFilter({
  filters,
  onChangeFilter
}: Pick<SearchControlsProps, "filters" | "onChangeFilter">) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>MRT radius</Text>
      <SelectField
        label="Near MRT"
        onChange={(value) => onChangeFilter("near_mrt", value)}
        options={mrtOptions}
        testID="radius-mrt-select"
        value={filters.near_mrt}
      />
      <SelectField
        label="Radius"
        onChange={(value) => onChangeFilter("radius_km", value)}
        options={radiusOptions}
        testID="radius-distance-select"
        value={filters.radius_km || "1"}
      />
    </View>
  );
}

export function SortAndViewControls({
  filters,
  onImmediateChange
}: SortAndViewControlsProps) {
  return (
    <View style={styles.sortRow}>
      <SelectField
        label="Sort"
        onChange={(value) => onImmediateChange({ ...filters, sort: value })}
        options={SORT_OPTIONS}
        testID="sort-select"
        value={filters.sort}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          onImmediateChange({
            ...filters,
            view: filters.view === "map" ? "grid" : "map"
          })
        }
        style={styles.secondaryButton}
        testID="map-toggle"
      >
        <Text style={styles.secondaryButtonText}>
          {filters.view === "map" ? "Show list" : "Show map"}
        </Text>
      </Pressable>
    </View>
  );
}

export function SaveSearchButton({ filters }: { filters: SearchFilters }) {
  const router = useRouter();
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("Tampines 4-room");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const query = useMemo(() => {
    const nextQuery = savedQueryFromFilters(filters);
    return Object.keys(nextQuery).length > 0 ? nextQuery : { sort: "newest" };
  }, [filters]);

  async function saveSearch() {
    if (!token) {
      router.push("/login" as Href);
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      await mobileApiClient.savedSearches.create({
        name: name.trim(),
        notify_email: true,
        query
      });
      setMessage("Saved search created");
      setIsOpen(false);
    } catch {
      setMessage("Could not save this search. Please check the filters and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.saveWrap}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={styles.secondaryButton}
        testID="save-search-button"
      >
        <Text style={styles.secondaryButtonText}>Save this search</Text>
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {isOpen ? (
        <View accessibilityLabel="Name this saved search" style={styles.dialog}>
          <Text style={styles.dialogTitle}>Name this saved search</Text>
          <TextField
            label="Search name"
            onChangeText={setName}
            value={name}
          />
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsOpen(false)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || name.trim().length === 0}
              onPress={() => void saveSearch()}
              style={[
                styles.primaryButton,
                isSaving || name.trim().length === 0 ? styles.disabled : null
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSaving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const webControlStyle = {
  borderColor: "#cbd5e1",
  borderRadius: 12,
  borderStyle: "solid",
  borderWidth: 1,
  color: "#0f172a",
  font: "inherit",
  padding: "10px 12px"
};

const webCheckboxStyle = {
  height: 16,
  width: 16
};

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4
  },
  checkboxBox: {
    alignItems: "center",
    borderColor: "#cbd5e1",
    borderRadius: 4,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  checkboxBoxChecked: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  checkboxRow: {
    alignItems: "center",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  checkboxText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700"
  },
  checkboxTick: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
    gap: 14,
    marginTop: 12,
    padding: 18,
    width: 320
  },
  dialogTitle: {
    color: "#020617",
    fontSize: 18,
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.6
  },
  field: {
    gap: 8
  },
  input: {
    borderColor: "#cbd5e1",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700"
  },
  message: {
    color: "#475569",
    fontSize: 13,
    marginTop: 8
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
    gap: 14,
    padding: 18
  },
  panelTitle: {
    color: "#020617",
    fontSize: 16,
    fontWeight: "800"
  },
  primaryButton: {
    backgroundColor: "#0f766e",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  saveWrap: {
    position: "relative",
    zIndex: 10
  },
  secondaryButton: {
    borderColor: "#0f766e",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 11
  },
  secondaryButtonText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "800"
  },
  sortRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-end"
  }
});
