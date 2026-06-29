"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Select } from "@base-ui/react/select";

type StatusValue = "all" | "completed" | "cancelled" | "rejected";

const STATUS_OPTIONS: Array<{ value: StatusValue; label: string }> = [
  { value: "all", label: "All closed orders" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
];

export function OrderHistoryStatusSelect({
  value,
}: {
  value: "" | Exclude<StatusValue, "all">;
}) {
  const [selected, setSelected] = useState<StatusValue>(value || "all");
  const selectedLabel =
    STATUS_OPTIONS.find((option) => option.value === selected)?.label ??
    STATUS_OPTIONS[0].label;

  return (
    <div className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zb-cream/50">
      <label id="order-history-status-label">Status</label>
      <Select.Root
        items={STATUS_OPTIONS}
        name="status"
        value={selected}
        onValueChange={(nextValue) => setSelected((nextValue ?? "all") as StatusValue)}
      >
        <Select.Trigger
          aria-labelledby="order-history-status-label"
          className="group flex h-10 w-full items-center rounded-md border border-zb-sage/25 bg-zb-primary px-3 text-left text-sm font-semibold normal-case tracking-normal text-zb-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition hover:border-zb-sage/60 data-[popup-open]:border-zb-bone/70 data-[popup-open]:ring-2 data-[popup-open]:ring-zb-bone/10 focus-visible:border-zb-bone/70 focus-visible:ring-2 focus-visible:ring-zb-bone/10"
        >
          <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
          <ChevronDown className="ml-3 size-4 shrink-0 text-zb-cream/55 transition group-data-[popup-open]:rotate-180 group-data-[popup-open]:text-zb-bone" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            sideOffset={8}
            align="start"
            alignItemWithTrigger={false}
            className="z-[70]"
          >
            <Select.Popup className="w-[var(--anchor-width)] min-w-60 origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-zb-bone/35 bg-zb-primary-dark p-1.5 text-zb-cream shadow-[0_22px_60px_rgba(0,0,0,0.55)] outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
              <Select.List className="max-h-72 overflow-y-auto overscroll-contain [scrollbar-color:rgba(229,192,123,0.6)_transparent] [scrollbar-width:thin]">
                {STATUS_OPTIONS.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className="grid min-h-10 cursor-default grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 text-sm font-semibold text-zb-cream/78 outline-none transition data-[highlighted]:bg-zb-sage/25 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:text-zb-primary-dark"
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator>
                      <Check className="size-4" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
