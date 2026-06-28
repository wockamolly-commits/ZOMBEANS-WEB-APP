"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MapPin } from "lucide-react";
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

export function DeliveryMapPicker({
  apiKey,
  storeLat,
  storeLng,
  tiers,
  maxKm,
  onChange,
}: {
  apiKey: string;
  storeLat: number;
  storeLng: number;
  tiers: DeliveryTier[];
  maxKm: number;
  onChange: (details: DeliveryDetails | null) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [quote, setQuote] = useState<Quote>({ state: "idle" });
  const partsRef = useRef<AddressParts>({
    street: "",
    barangay: null,
    city: "San Carlos City",
    placeId: null,
  });

  async function runQuote(lat: number, lng: number) {
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
      onChange(null);
      return;
    }

    if (!result.inZone || result.tier === null || result.feeCents === null) {
      setQuote({ state: "out_of_zone", distanceKm: result.distanceKm });
      onChange(null);
      return;
    }

    setQuote({
      state: "in_zone",
      distanceKm: result.distanceKm,
      feeCents: result.feeCents,
    });
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

  async function reverseGeocode(lat: number, lng: number) {
    const geocoder = geocoderRef.current;
    if (geocoder) {
      try {
        const { results } = await geocoder.geocode({ location: { lat, lng } });
        const best = results[0];
        partsRef.current = {
          street: best?.formatted_address ?? partsRef.current.street,
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
        // Keep prior parts; the quote still uses coordinates.
      }
    }

    await runQuote(lat, lng);
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
      <div
        ref={mapRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-zb-sage/35 bg-zb-primary-dark/40"
        aria-label="Delivery location map"
      />
      <p className="text-xs text-zb-cream/50">
        {ready
          ? "Search above or drag the pin to your exact location."
          : "Loading map..."}
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
