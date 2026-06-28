"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { LocateFixed, MapPin } from "lucide-react";
import { quoteDelivery } from "@/app/actions/checkout";
import {
  haversineKm,
  resolveDeliveryQuote,
  type DeliveryTier,
} from "@/lib/delivery";
import { formatPeso } from "@/lib/peso";

export type DeliveryDetails = {
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  street: string;
  barangay: string | null;
  city: string;
  tier: string;
  feeCents: number;
  distanceKm: number;
};

type Quote =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "in_zone"; distanceKm: number; feeCents: number }
  | { state: "out_of_zone"; distanceKm: number };

type LocationStatus =
  | { state: "idle" }
  | { state: "detecting" }
  | { state: "detected" }
  | { state: "denied" }
  | { state: "unavailable" };

type AddressParts = {
  street: string;
  barangay: string | null;
  city: string;
  placeId: string | null;
};

function pickComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string
): string | null {
  return components?.find((component) => component.types.includes(type))
    ?.long_name ?? null;
}

function pickPlaceComponent(
  components: google.maps.places.AddressComponent[] | undefined,
  type: string
): string | null {
  return components?.find((component) => component.types.includes(type))
    ?.longText ?? null;
}

function locationHelpText(status: LocationStatus): string {
  switch (status.state) {
    case "detecting":
      return "Detecting your current location...";
    case "detected":
      return "Detected your location. Drag the pin if it needs a small adjustment.";
    case "denied":
      return "Location permission was denied. Search above or drag the pin manually.";
    case "unavailable":
      return "Current location is unavailable. Search above or drag the pin manually.";
    case "idle":
      return "Search above or drag the pin to your exact location.";
  }
}

export type DetectedGps = { lat: number; lng: number; address: string | null };

export function DeliveryMapPicker({
  apiKey,
  storeLat,
  storeLng,
  tiers,
  maxKm,
  initialLat,
  initialLng,
  onChange,
  onGpsDetected,
}: {
  apiKey: string;
  storeLat: number;
  storeLng: number;
  tiers: DeliveryTier[];
  maxKm: number;
  // When provided, the map opens centered on this pin (e.g. a saved address)
  // instead of auto-detecting. The fee is shown for it, but onChange is not
  // emitted unless the customer re-pins, so the saved address stays in effect.
  initialLat?: number;
  initialLng?: number;
  onChange: (details: DeliveryDetails | null) => void;
  // Reports the raw device GPS reading (separate from the chosen pin) so the
  // order can store the auto-detected location alongside the delivery address.
  onGpsDetected?: (gps: DetectedGps) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [quote, setQuote] = useState<Quote>({ state: "idle" });
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    state: "idle",
  });
  const partsRef = useRef<AddressParts>({
    street: "",
    barangay: null,
    city: "San Carlos City",
    placeId: null,
  });

  // emit=false shows the fee for a pin without pushing it up as the chosen
  // delivery location — used to preview a saved address without overriding it.
  async function runQuote(lat: number, lng: number, emit = true) {
    const local = resolveDeliveryQuote(
      haversineKm(storeLat, storeLng, lat, lng),
      tiers,
      maxKm
    );
    setQuote(
      local.inZone
        ? {
            state: "in_zone",
            distanceKm: local.distanceKm,
            feeCents: local.feeCents,
          }
        : { state: "out_of_zone", distanceKm: local.distanceKm }
    );

    const result = await quoteDelivery({ lat, lng });
    if (!result.ok) {
      setQuote({ state: "idle" });
      if (emit) onChange(null);
      return;
    }

    if (!result.inZone || result.tier === null || result.feeCents === null) {
      setQuote({ state: "out_of_zone", distanceKm: result.distanceKm });
      if (emit) onChange(null);
      return;
    }

    setQuote({
      state: "in_zone",
      distanceKm: result.distanceKm,
      feeCents: result.feeCents,
    });
    if (emit)
      onChange({
        lat,
        lng,
        googlePlaceId: partsRef.current.placeId,
        street: partsRef.current.street,
        barangay: partsRef.current.barangay,
        city: partsRef.current.city,
        tier: result.tier,
        feeCents: result.feeCents,
        distanceKm: result.distanceKm,
      });
  }

  // Reverse-geocode without mutating partsRef (which describes the pin).
  async function geocodeOnly(lat: number, lng: number): Promise<string | null> {
    const geocoder = geocoderRef.current;
    if (!geocoder) return null;
    try {
      const { results } = await geocoder.geocode({ location: { lat, lng } });
      return results[0]?.formatted_address ?? null;
    } catch {
      return null;
    }
  }

  // Read the device GPS for the order's auto-detected location WITHOUT moving
  // the pin (used when the pin is already placed on a saved address).
  function reportGpsOnly() {
    if (!("geolocation" in navigator)) {
      setLocationStatus({ state: "unavailable" });
      return;
    }
    setLocationStatus({ state: "detecting" });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocationStatus({ state: "detected" });
        onGpsDetected?.({ lat, lng, address: await geocodeOnly(lat, lng) });
      },
      (error) => {
        setLocationStatus({
          state: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
    );
  }

  async function reverseGeocode(lat: number, lng: number) {
    const geocoder = geocoderRef.current;
    if (geocoder) {
      try {
        const { results } = await geocoder.geocode({ location: { lat, lng } });
        const best = results[0];
        partsRef.current = {
          street:
            best?.formatted_address ||
            partsRef.current.street ||
            "Pinned location",
          barangay:
            pickComponent(best?.address_components, "sublocality_level_1") ??
            pickComponent(best?.address_components, "neighborhood") ??
            partsRef.current.barangay,
          city:
            pickComponent(best?.address_components, "locality") ??
            partsRef.current.city,
          placeId: best?.place_id ?? null,
        };
      } catch {
        partsRef.current = {
          ...partsRef.current,
          street: partsRef.current.street || "Pinned location",
        };
      }
    }

    await runQuote(lat, lng);
  }

  function detectCurrentLocation(
    map: google.maps.Map,
    marker: google.maps.Marker
  ) {
    if (!("geolocation" in navigator)) {
      setLocationStatus({ state: "unavailable" });
      return;
    }

    setLocationStatus({ state: "detecting" });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setCenter({ lat, lng });
        map.setZoom(17);
        marker.setPosition({ lat, lng });
        setLocationStatus({ state: "detected" });
        await reverseGeocode(lat, lng);
        // The pin sits on the device location at this point, so the geocoded
        // address describes the GPS reading itself.
        onGpsDetected?.({ lat, lng, address: partsRef.current.street || null });
      },
      (error) => {
        setLocationStatus({
          state: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
    );
  }

  function locateCustomerPin() {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) {
      setLocationStatus({ state: "unavailable" });
      return;
    }
    detectCurrentLocation(map, marker);
  }

  useEffect(() => {
    let cancelled = false;
    const loader = new Loader({ apiKey, libraries: ["places"] });

    loader
      .load()
      .then(async (google) => {
        if (cancelled || !mapRef.current || !autocompleteRef.current) return;

        const center = { lat: storeLat, lng: storeLng };
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
        });
        const marker = new google.maps.Marker({ map, draggable: true });
        mapInstanceRef.current = map;
        markerRef.current = marker;
        geocoderRef.current = new google.maps.Geocoder();

        const { PlaceAutocompleteElement } =
          (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        const autocomplete = new PlaceAutocompleteElement();
        autocomplete.placeholder = "Search your address or landmark";
        autocomplete.includedRegionCodes = ["ph"];
        autocomplete.locationBias = {
          center,
          radius: Math.max(maxKm * 1000, 5000),
        };
        autocomplete.className = "block w-full";
        autocompleteRef.current.replaceChildren(autocomplete);

        autocomplete.addEventListener("gmp-select", async (event) => {
          const { placePrediction } =
            event as google.maps.places.PlacePredictionSelectEvent;
          const place = placePrediction.toPlace();
          await place.fetchFields({
            fields: [
              "addressComponents",
              "displayName",
              "formattedAddress",
              "id",
              "location",
            ],
          });
          if (!place.location) return;

          const lat = place.location.lat();
          const lng = place.location.lng();
          map.setCenter({ lat, lng });
          map.setZoom(16);
          marker.setPosition({ lat, lng });
          partsRef.current = {
            street:
              place.formattedAddress ?? place.displayName ?? partsRef.current.street,
            barangay:
              pickPlaceComponent(place.addressComponents, "sublocality_level_1") ??
              pickPlaceComponent(place.addressComponents, "neighborhood"),
            city:
              pickPlaceComponent(place.addressComponents, "locality") ??
              "San Carlos City",
            placeId: place.id ?? null,
          };
          void runQuote(lat, lng);
        });

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          void reverseGeocode(pos.lat(), pos.lng());
        });

        setReady(true);
        if (initialLat != null && initialLng != null) {
          // Saved address: center + pin on it and preview its fee, but don't
          // emit (the saved address stays in effect unless the customer re-pins).
          map.setCenter({ lat: initialLat, lng: initialLng });
          map.setZoom(16);
          marker.setPosition({ lat: initialLat, lng: initialLng });
          void runQuote(initialLat, initialLng, false);
          // Still record the device GPS for the order's detected location.
          reportGpsOnly();
        } else {
          detectCurrentLocation(map, marker);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) {
    return (
      <p className="rounded-xl border border-zb-danger/40 bg-zb-danger/10 p-4 text-sm text-zb-cream">
        We could not load the map. Please refresh, or switch to pickup.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={autocompleteRef}
        className="min-h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-3 py-1 text-zb-primary-dark focus-within:border-zb-bone focus-within:outline-none focus-within:ring-2 focus-within:ring-zb-bone/20"
      />
      <div className="relative">
        <div
          ref={mapRef}
          className="h-64 w-full overflow-hidden rounded-xl border border-zb-sage/35 bg-zb-primary-dark/40"
          aria-label="Delivery location map"
        />
        <button
          type="button"
          onClick={locateCustomerPin}
          disabled={!ready || locationStatus.state === "detecting"}
          className="absolute bottom-3 left-3 inline-flex size-10 items-center justify-center rounded-xl border border-black/10 bg-white text-[#4285f4] shadow-md shadow-black/20 transition hover:bg-slate-50 disabled:opacity-60"
          aria-label="Use current location"
          title="Use current location"
        >
          <LocateFixed className="size-5" strokeWidth={2.4} />
        </button>
      </div>
      <p className="text-xs text-zb-cream/50">
        {ready ? locationHelpText(locationStatus) : "Loading map..."}
      </p>

      {quote.state === "in_zone" && (
        <div className="flex items-center justify-between rounded-xl border border-zb-bone/40 bg-zb-bone/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-zb-cream">
            <MapPin className="size-4 text-zb-bone" />
            About {quote.distanceKm.toFixed(1)} km from Zombeans
          </span>
          <span className="font-mono-tabular font-bold text-zb-bone">
            {formatPeso(quote.feeCents)}
          </span>
        </div>
      )}
      {quote.state === "out_of_zone" && (
        <p className="rounded-xl border border-zb-danger/40 bg-zb-danger/10 px-4 py-3 text-sm text-zb-cream">
          That location is about {quote.distanceKm.toFixed(1)} km away - outside
          our {maxKm} km delivery zone. Please switch to pickup; your cart stays
          right here.
        </p>
      )}
    </div>
  );
}
