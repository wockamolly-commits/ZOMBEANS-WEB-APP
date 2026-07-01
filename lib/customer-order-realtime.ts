export type CustomerOrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "rejected"
  | "cancelled";

export type CustomerServiceMode =
  | "dine_in"
  | "take_out"
  | "pickup"
  | "delivery";

export type CustomerOrderAlertStatus =
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "rejected";

export type CustomerOrderStatusPayload = {
  shortCode: string;
  status: CustomerOrderStatus;
  serviceMode: CustomerServiceMode | null;
  rejectedReason: string | null;
  readyAcknowledgedAt?: string | null;
  changedAt: string;
};

export const CUSTOMER_ORDER_EVENT = "order-status";
export const CUSTOMER_RIDER_OUTSIDE_EVENT = "rider-outside";
export const CUSTOMER_ORDER_TRACKING_EVENT = "zb-customer-orders-changed";
export const CUSTOMER_READY_ACK_EVENT = "zb-customer-ready-acknowledged";
export const CUSTOMER_RIDER_OUTSIDE_ACK_EVENT =
  "zb-customer-rider-outside-acknowledged";
export const CUSTOMER_ORDER_STORAGE_KEY = "zb-customer-orders";

// One-shot ping a rider sends from the field once they have arrived at the
// customer's location. It is intentionally not an order status: the order stays
// `out_for_delivery`, this just triggers an instant alert on the customer side.
export type CustomerRiderOutsidePayload = {
  shortCode: string;
  ringId: string;
  sentAt: string;
};

export function normalizeOrderCode(code: string) {
  return code.trim().toUpperCase();
}

export function customerOrderTopic(shortCode: string) {
  return `customer-order:${normalizeOrderCode(shortCode)}`;
}

export function isCustomerTerminalAlertStatus(
  status: CustomerOrderStatus
): status is "completed" | "rejected" {
  return status === "completed" || status === "rejected";
}

export function isCustomerReadyAlert(
  status: CustomerOrderStatus,
  serviceMode: CustomerServiceMode | null | undefined
): status is "ready" {
  return (
    status === "ready" &&
    (serviceMode === "pickup" ||
      serviceMode === "dine_in" ||
      serviceMode === "delivery")
  );
}

export function isCustomerOutForDeliveryAlert(
  status: CustomerOrderStatus,
  serviceMode: CustomerServiceMode | null | undefined
): status is "out_for_delivery" {
  return status === "out_for_delivery" && serviceMode === "delivery";
}

export function isCustomerOrderAlert(
  status: CustomerOrderStatus,
  serviceMode: CustomerServiceMode | null | undefined
): status is CustomerOrderAlertStatus {
  return (
    isCustomerTerminalAlertStatus(status) ||
    isCustomerReadyAlert(status, serviceMode) ||
    isCustomerOutForDeliveryAlert(status, serviceMode)
  );
}
