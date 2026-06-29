export type RiderNotificationKind =
  | "assignment"
  | "order_status"
  | "delivery_cancelled"
  | "delivery_details"
  | "payment_status";

export type RiderNotification = {
  id: string;
  rider_profile_id: string;
  order_id: string | null;
  kind: RiderNotificationKind;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};
