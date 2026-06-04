import type { ListingSummary } from "@proppy/shared/types";
import { useEffect, useMemo, useState } from "react";
import { formatListingPrice } from "../../lib/listing-format";

const ONE_MAP_ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px" alt="OneMap"> &copy; contributors | <a href="https://www.onemap.gov.sg/">OneMap</a>';

const LEAFLET_MINIMAL_CSS = `
  .leaflet-container{overflow:hidden;position:relative;touch-action:none;}
  .leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0;}
  .leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow{-webkit-user-drag:none;user-select:none;}
  .leaflet-container img{max-width:none!important;max-height:none!important;}
  .leaflet-popup{position:absolute;text-align:center;margin-bottom:20px;}
  .leaflet-popup-content-wrapper{background:white;border-radius:12px;box-shadow:0 3px 14px rgba(0,0,0,.25);padding:10px;}
  .leaflet-control-container{display:none;}
`;

type LeafletModules = {
  L: typeof import("leaflet");
  MapContainer: typeof import("react-leaflet").MapContainer;
  Marker: typeof import("react-leaflet").Marker;
  Popup: typeof import("react-leaflet").Popup;
  TileLayer: typeof import("react-leaflet").TileLayer;
};

type MobileMapViewProps = {
  listings: ListingSummary[];
  onOpenListing: (id: string) => void;
};

export function MobileMapView({ listings, onOpenListing }: MobileMapViewProps) {
  const [modules, setModules] = useState<LeafletModules | null>(null);
  const markerListings = listings.filter(
    (listing) =>
      typeof listing.latitude === "number" &&
      typeof listing.longitude === "number"
  );
  const first = markerListings[0];
  const center: [number, number] =
    first?.latitude && first.longitude
      ? [first.latitude, first.longitude]
      : [1.3521, 103.8198];

  useEffect(() => {
    let isMounted = true;
    Promise.all([import("leaflet"), import("react-leaflet")]).then(
      ([leaflet, reactLeaflet]) => {
        if (isMounted) {
          setModules({
            L: leaflet,
            MapContainer: reactLeaflet.MapContainer,
            Marker: reactLeaflet.Marker,
            Popup: reactLeaflet.Popup,
            TileLayer: reactLeaflet.TileLayer
          });
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, []);

  const markerIcon = useMemo(() => {
    if (!modules) {
      return null;
    }

    return modules.L.divIcon({
      className: "proppy-map-marker",
      html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#0f766e;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35)"></span>',
      iconAnchor: [12, 12],
      iconSize: [24, 24]
    });
  }, [modules]);

  if (!modules || !markerIcon) {
    return (
      <div
        aria-label="Map view"
        style={{
          alignItems: "center",
          background: "#ecfeff",
          border: "1px solid #99f6e4",
          borderRadius: 20,
          color: "#0f766e",
          display: "flex",
          fontWeight: 700,
          minHeight: 520,
          padding: 20
        }}
      >
        Loading map…
      </div>
    );
  }

  const { MapContainer, Marker, Popup, TileLayer } = modules;

  return (
    <div
      aria-label="Map view"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 20,
        minHeight: 520,
        overflow: "hidden"
      }}
    >
      <style>{LEAFLET_MINIMAL_CSS}</style>
      <MapContainer
        center={center}
        scrollWheelZoom={false}
        style={{ height: 520, width: "100%" }}
        zoom={12}
      >
        <TileLayer
          attribution={ONE_MAP_ATTRIBUTION}
          subdomains={["a", "b", "c"]}
          url="https://maps-{s}.onemap.gov.sg/lite/web/2024/{z}/{x}/{y}.png"
        />
        {markerListings.map((listing) => (
          <Marker
            icon={markerIcon}
            key={listing.id}
            position={[listing.latitude!, listing.longitude!]}
          >
            <Popup>
              <button
                onClick={() => onOpenListing(listing.id)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#0f766e",
                  cursor: "pointer",
                  fontWeight: 700,
                  padding: 0,
                  textAlign: "left"
                }}
                type="button"
              >
                {listing.title}
              </button>
              <br />
              {formatListingPrice(listing.price_sgd)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
