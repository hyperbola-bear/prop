"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { ListingSummary } from "../../../../packages/shared/src/types";
import { formatSGD } from "../../lib/format";

const ONE_MAP_ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px" alt="OneMap"> &copy; contributors | <a href="https://www.onemap.gov.sg/">OneMap</a>';

const markerIcon = L.divIcon({
  className: "proppy-map-marker",
  html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#0f766e;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35)"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

type MapViewProps = {
  listings: ListingSummary[];
};

export default function MapView({ listings }: MapViewProps) {
  const markerListings = listings.filter(
    (listing) => typeof listing.latitude === "number" && typeof listing.longitude === "number"
  );
  const first = markerListings[0];
  const center: [number, number] = first?.latitude && first.longitude
    ? [first.latitude, first.longitude]
    : [1.3521, 103.8198];

  return (
    <section aria-label="Map view" className="overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-[520px] w-full">
        <TileLayer
          url="https://maps-{s}.onemap.gov.sg/lite/web/2024/{z}/{x}/{y}.png"
          subdomains={["a", "b", "c"]}
          attribution={ONE_MAP_ATTRIBUTION}
        />
        {markerListings.map((listing) => (
          <Marker
            key={listing.id}
            position={[listing.latitude!, listing.longitude!]}
            icon={markerIcon}
          >
            <Popup>
              <a href={`/listings/${listing.id}`} className="font-semibold text-proppy-primary">
                {listing.title}
              </a>
              <br />
              {formatSGD(listing.price_sgd)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}
