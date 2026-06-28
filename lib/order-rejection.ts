export const ORDER_REJECTION_REASONS = [
  "Item unavailable",
  "Store is too busy",
  "Outside delivery area",
  "Incorrect order details",
  "Delivery unavailable",
  "Technical issue",
  "Store closing soon",
  "Payment issue",
] as const;

export type OrderRejectionReason = (typeof ORDER_REJECTION_REASONS)[number];

export function isOrderRejectionReason(
  value: string
): value is OrderRejectionReason {
  return ORDER_REJECTION_REASONS.includes(value as OrderRejectionReason);
}

export function formatRejectionReason(
  reason: OrderRejectionReason,
  note?: string
): string {
  const trimmedNote = note?.trim();
  return trimmedNote ? `${reason}: ${trimmedNote}` : reason;
}
