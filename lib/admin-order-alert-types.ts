export type AdminOrderAlert = {
  id: string;
  shortCode: string;
  placedAt: string;
  serviceMode: "dine_in" | "take_out" | "pickup" | "delivery";
  customerName: string;
  totalCents: number;
  itemCount: number;
};

export type AdminOrderAlertSnapshot = {
  pendingCount: number;
  orders: AdminOrderAlert[];
};
