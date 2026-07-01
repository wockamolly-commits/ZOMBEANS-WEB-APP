export type DeliveryAddressLike = {
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  landmark?: string | null;
  delivery_notes?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  detected_lat?: number | string | null;
  detected_lng?: number | string | null;
  detected_address?: string | null;
};

function clean(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export function formatDeliveryAddress(
  address: DeliveryAddressLike | null | undefined,
  fallback = "Address unavailable"
) {
  if (!address) return fallback;
  const formatted = [
    clean(address.street),
    clean(address.barangay),
    clean(address.city),
  ]
    .filter(Boolean)
    .join(", ");

  return formatted || fallback;
}

export function formatSubmittedDeliveryAddress(
  address: DeliveryAddressLike | null | undefined,
  fallback = "Address unavailable"
) {
  if (!address) return fallback;

  const hasCustomerText = Boolean(clean(address.street) || clean(address.barangay));
  if (hasCustomerText) {
    return formatDeliveryAddress(address, fallback);
  }

  return (
    clean(address.detected_address) ??
    coordsLabel(address.lat, address.lng) ??
    fallback
  );
}

export function coordsLabel(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined
) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  return `${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)}`;
}

export function detectedLocationLabel(
  address: DeliveryAddressLike | null | undefined,
  fallback = "Pin unavailable"
) {
  if (!address) return fallback;
  const detectedAddress = clean(address.detected_address);
  if (detectedAddress) return detectedAddress;

  return (
    coordsLabel(address.detected_lat, address.detected_lng) ??
    coordsLabel(address.lat, address.lng) ??
    fallback
  );
}

export function coordsFrom(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined
) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : { lat: null, lng: null };
}
