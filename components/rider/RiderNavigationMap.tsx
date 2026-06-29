"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Crosshair, ExternalLink, LocateFixed, Map, Navigation } from "lucide-react";

type Coord = {
  lat: number;
  lng: number;
};

type RouteState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; distance: string; duration: string }
  | { status: "error"; message: string };

function validCoord(lat: number | null, lng: number | null): Coord | null {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

function directionsUrl(destination: Coord) {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving&dir_action=navigate`;
}

function wazeUrl(destination: Coord) {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}

export function RiderNavigationMap({
  apiKey,
  submittedLat,
  submittedLng,
  detectedLat,
  detectedLng,
  submittedAddress,
  detectedAddress,
  className = "",
}: {
  apiKey: string | null;
  submittedLat: number | null;
  submittedLng: number | null;
  detectedLat: number | null;
  detectedLng: number | null;
  submittedAddress: string;
  detectedAddress: string | null;
  className?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsService = useRef<google.maps.DirectionsService | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState<RouteState>({ status: "idle" });
  const inAppDirectionsEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_DIRECTIONS_ENABLED === "true";

  const submitted = useMemo(
    () => validCoord(submittedLat, submittedLng),
    [submittedLat, submittedLng]
  );
  const detected = useMemo(
    () => validCoord(detectedLat, detectedLng),
    [detectedLat, detectedLng]
  );
  const destination = detected ?? submitted;
  const googleMapsHref = destination
    ? directionsUrl(destination)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(submittedAddress)}`;
  const wazeHref = destination ? wazeUrl(destination) : null;

  useEffect(() => {
    if (!apiKey || !destination || !mapRef.current) return;

    let cancelled = false;
    const loader = new Loader({ apiKey });
    loader
      .load()
      .then((google) => {
        if (cancelled || !mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: destination,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        mapInstance.current = map;
        if (inAppDirectionsEnabled) {
          directionsService.current = new google.maps.DirectionsService();
          directionsRenderer.current = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: false,
            preserveViewport: false,
          });
        }

        new google.maps.Marker({
          map,
          position: destination,
          title: "Customer GPS pin",
          label: "G",
        });

        if (
          submitted &&
          detected &&
          (Math.abs(submitted.lat - detected.lat) > 0.00001 ||
            Math.abs(submitted.lng - detected.lng) > 0.00001)
        ) {
          new google.maps.Marker({
            map,
            position: submitted,
            title: "Submitted address pin",
            label: "A",
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, destination, detected, inAppDirectionsEnabled, submitted]);

  function locateAndRoute() {
    if (!inAppDirectionsEnabled) {
      setRoute({
        status: "error",
        message: "In-app routing is not enabled for this Google Maps key.",
      });
      return;
    }
    if (!destination || !directionsService.current || !directionsRenderer.current) {
      setRoute({ status: "error", message: "Map directions are unavailable." });
      return;
    }
    if (!("geolocation" in navigator)) {
      setRoute({ status: "error", message: "Current location is unavailable." });
      return;
    }

    setRoute({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        directionsService.current?.route(
          {
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status !== google.maps.DirectionsStatus.OK || !result) {
              setRoute({
                status: "error",
                message:
                  status === google.maps.DirectionsStatus.REQUEST_DENIED
                    ? "This Google Maps key is not authorized for in-app directions."
                    : "Could not calculate a route.",
              });
              return;
            }
            directionsRenderer.current?.setDirections(result);
            const leg = result.routes[0]?.legs[0];
            setRoute({
              status: "ready",
              distance: leg?.distance?.text ?? "Distance unavailable",
              duration: leg?.duration?.text ?? "ETA unavailable",
            });
          }
        );
      },
      (error) => {
        setRoute({
          status: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : "Could not get current location.",
        });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  }

  function centerOnRider() {
    const map = mapInstance.current;
    if (!map || !("geolocation" in navigator)) {
      setRoute({ status: "error", message: "Current location is unavailable." });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setCenter(current);
        map.setZoom(16);
        if (riderMarker.current) {
          riderMarker.current.setPosition(current);
        } else {
          riderMarker.current = new google.maps.Marker({
            map,
            position: current,
            title: "Your current location",
            label: "Y",
          });
        }
        setLocating(false);
      },
      (error) => {
        setRoute({
          status: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : "Could not get current location.",
        });
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  }

  if (!destination) {
    return (
      <div className={`rounded-lg border border-zb-sage/20 bg-zb-primary/30 p-3 text-sm text-zb-cream/55 ${className}`}>
        Customer coordinates are unavailable. Use the submitted address in Maps.
        <a
          href={googleMapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zb-sage/35 font-semibold text-zb-cream"
        >
          <Map className="size-4" />
          Open address
        </a>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {apiKey && !loadError ? (
        <div className="relative">
          <div
            ref={mapRef}
            className="h-56 w-full overflow-hidden rounded-lg border border-zb-sage/25 bg-zb-primary/45"
            aria-label="Customer location and delivery route map"
          />
          <button
            type="button"
            onClick={centerOnRider}
            disabled={locating}
            className="absolute bottom-3 left-3 inline-flex size-10 items-center justify-center rounded-xl border border-black/10 bg-white text-[#4285f4] shadow-md shadow-black/20 transition hover:bg-slate-50 disabled:opacity-60"
            aria-label="Show current location"
            title="Show current location"
          >
            <LocateFixed className="size-5" strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-lg border border-zb-sage/20 bg-zb-primary/35 px-4 text-center text-sm text-zb-cream/55">
          Map preview is unavailable. Navigation links still work.
        </div>
      )}

      <div className="grid gap-2 text-xs text-zb-cream/55 sm:grid-cols-2">
        <p className="rounded-lg bg-zb-primary/30 px-3 py-2">
          <span className="block font-semibold uppercase tracking-[0.12em] text-zb-cream/35">
            Destination
          </span>
          {detectedAddress || "Customer GPS pin"}
        </p>
        <p className="rounded-lg bg-zb-primary/30 px-3 py-2">
          <span className="block font-semibold uppercase tracking-[0.12em] text-zb-cream/35">
            Submitted
          </span>
          {submittedAddress}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={locateAndRoute}
          disabled={
            !apiKey ||
            loadError ||
            !inAppDirectionsEnabled ||
            route.status === "locating"
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zb-bone text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55"
        >
          <Crosshair className="size-4" />
          {route.status === "locating" ? "Routing..." : "Route"}
        </button>
        <a
          href={googleMapsHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zb-sage/35 text-sm font-semibold text-zb-cream transition hover:bg-zb-primary"
        >
          <Navigation className="size-4" />
          Google Maps
        </a>
        {wazeHref && (
          <a
            href={wazeHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zb-sage/35 text-sm font-semibold text-zb-cream transition hover:bg-zb-primary"
          >
            <ExternalLink className="size-4" />
            Waze
          </a>
        )}
      </div>

      {route.status === "ready" && (
        <p className="rounded-lg bg-zb-primary/35 px-3 py-2 text-sm text-zb-cream/70">
          Driving route:{" "}
          <span className="font-mono-tabular text-zb-bone">{route.distance}</span>
          {" - "}
          <span className="font-mono-tabular text-zb-bone">{route.duration}</span>
        </p>
      )}
      {route.status === "error" && (
        <p className="rounded-lg border border-zb-danger/35 bg-zb-danger/10 px-3 py-2 text-sm text-zb-cream/70">
          {route.message}
        </p>
      )}
    </div>
  );
}
