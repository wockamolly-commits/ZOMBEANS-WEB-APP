"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { Select } from "@base-ui/react/select";
import {
  setHighDemand,
  setStoreClosed,
  setStoreOpen,
} from "@/app/workspace/availability/actions";
import {
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_MAX_MINUTES,
  HIGH_DEMAND_MIN_MINUTES,
  HIGH_DEMAND_STEP_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
  type ClosureReasonCode,
  type StoreAvailability,
} from "@/lib/store-availability";

const REASONS: { value: ClosureReasonCode; label: string }[] = [
  { value: "today", label: "Unavailable for today" },
  { value: "temporary", label: "Temporarily closed" },
  { value: "kitchen", label: "Kitchen unavailable" },
  { value: "inventory", label: "Inventory shortage" },
  { value: "maintenance", label: "Maintenance" },
  { value: "custom", label: "Custom reason" },
];

export function StoreAvailabilityModal({
  state,
  onClose,
}: {
  state: StoreAvailability;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingClosed, setEditingClosed] = useState(!state.isOpen);
  const [reason, setReason] = useState<ClosureReasonCode>(
    state.closureReasonCode ?? "temporary"
  );
  const [note, setNote] = useState(state.closureNote ?? "");
  const [until, setUntil] = useState("");
  const [minutes, setMinutes] = useState(
    state.prepBufferMinutes || HIGH_DEMAND_DEFAULT_MINUTES
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Update store status"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-zb-sage/25 bg-zb-primary-strong shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zb-sage/20 px-5 py-4">
          <div>
            <h2 className="font-display text-2xl text-zb-cream">Update your status</h2>
            <p className="mt-1 text-sm text-zb-cream/55">
              The webstore is {state.isOpen ? "open" : "closed"}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-zb-sage/25 text-zb-cream/60 transition hover:bg-zb-primary hover:text-zb-cream"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {/* OPEN */}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(setStoreOpen)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
              state.isOpen
                ? "border-emerald-400/70 bg-emerald-400/10"
                : "border-zb-sage/25 bg-zb-primary-dark/35 hover:border-zb-sage"
            }`}
          >
            <span className="mt-1 size-3 shrink-0 rounded-full bg-emerald-400" />
            <span>
              <span className="block font-semibold text-zb-cream">Open</span>
              <span className="text-sm text-zb-cream/60">
                Receive incoming orders as usual
              </span>
            </span>
          </button>

          {/* HIGH DEMAND */}
          <div
            className={`rounded-2xl border p-4 transition ${
              state.highDemand
                ? "border-zb-bone/70 bg-zb-bone/10"
                : "border-zb-sage/25 bg-zb-primary-dark/35"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block font-semibold text-zb-cream">
                  High Demand mode
                </span>
                <span className="text-sm text-zb-cream/60">
                  Stay open with automatically increased preparation time
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.highDemand}
                aria-label="High demand mode"
                disabled={pending || !state.isOpen}
                onClick={() =>
                  state.highDemand
                    ? run(() => setHighDemand({ enabled: false }))
                    : run(() => setHighDemand({ enabled: true, minutes }))
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  state.highDemand ? "bg-emerald-500" : "bg-zb-primary/30"
                } disabled:opacity-40`}
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${
                    state.highDemand ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {state.isOpen && (
              <div className="mt-4">
                <p className="text-sm font-medium text-zb-cream">
                  How much extra time do you need?
                </p>
                <div className="mt-2 rounded-xl border border-zb-bone/30 bg-zb-bone/10 px-3 py-2 text-xs leading-5 text-zb-cream/75">
                  For future orders only — this won&apos;t change the prep time of
                  current orders.
                </div>
                <div className="mt-4 flex items-center justify-center gap-5">
                  <button
                    type="button"
                    aria-label="Decrease"
                    disabled={minutes <= HIGH_DEMAND_MIN_MINUTES}
                    onClick={() =>
                      setMinutes((m) =>
                        Math.max(HIGH_DEMAND_MIN_MINUTES, m - HIGH_DEMAND_STEP_MINUTES)
                      )
                    }
                    className="grid size-10 place-items-center rounded-full border border-zb-sage/30 text-zb-cream disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <div className="text-center">
                    <span className="block font-display text-3xl text-zb-cream">
                      {minutes}
                    </span>
                    <span className="text-xs text-zb-cream/50">min</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase"
                    disabled={minutes >= HIGH_DEMAND_MAX_MINUTES}
                    onClick={() =>
                      setMinutes((m) =>
                        Math.min(HIGH_DEMAND_MAX_MINUTES, m + HIGH_DEMAND_STEP_MINUTES)
                      )
                    }
                    className="grid size-10 place-items-center rounded-full border border-zb-sage/30 text-zb-cream disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-zb-cream/50">
                  Preparation time will be extended for the next{" "}
                  {HIGH_DEMAND_WINDOW_MINUTES} minutes.
                </p>
                {state.highDemand && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setHighDemand({ enabled: true, minutes }))}
                    className="mt-3 w-full rounded-xl border border-zb-bone/45 py-2 text-sm font-semibold text-zb-cream transition hover:bg-zb-bone/10"
                  >
                    Update extra time
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CLOSED */}
          <div
            className={`rounded-2xl border p-4 transition ${
              !state.isOpen
                ? "border-zb-danger/70 bg-zb-danger/10"
                : "border-zb-sage/25 bg-zb-primary-dark/35"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 size-3 shrink-0 rounded-full bg-zb-danger" />
                <div>
                  <span className="block font-semibold text-zb-cream">Closed</span>
                  <span className="text-sm text-zb-cream/60">
                    {state.closureLabel ?? "Pause incoming online orders"}
                  </span>
                </div>
              </div>
              {!editingClosed && (
                <button
                  type="button"
                  onClick={() => setEditingClosed(true)}
                  className="rounded-lg border border-zb-bone/45 px-3 py-1 text-sm font-semibold text-zb-bone transition hover:bg-zb-bone/10"
                >
                  Edit
                </button>
              )}
            </div>

            {editingClosed && (
              <div className="mt-4 space-y-3">
                <Select.Root
                  items={REASONS}
                  value={reason}
                  onValueChange={(v) => setReason(v as ClosureReasonCode)}
                >
                  <Select.Trigger className="group flex h-12 w-full items-center rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-left text-sm text-zb-cream outline-none transition hover:border-zb-sage data-[popup-open]:border-zb-bone">
                    <Select.Value placeholder="Choose a reason" className="flex-1" />
                    <ChevronDown className="ml-3 size-4 text-zb-cream/50 transition group-data-[popup-open]:rotate-180" />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner sideOffset={8} className="z-[70]">
                      <Select.Popup className="w-[var(--anchor-width)] rounded-2xl border border-zb-bone/45 bg-zb-primary-dark p-2 text-zb-cream shadow-2xl outline-none">
                        {REASONS.map((r) => (
                          <Select.Item
                            key={r.value}
                            value={r.value}
                            className="grid min-h-10 cursor-default grid-cols-[1fr_auto] items-center rounded-xl px-3 text-sm text-zb-cream/75 outline-none data-[highlighted]:bg-zb-sage/25 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:font-semibold data-[selected]:text-zb-primary-dark"
                          >
                            <Select.ItemText>{r.label}</Select.ItemText>
                            <Select.ItemIndicator className="ml-3">
                              <Check className="size-4" />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>

                {reason === "custom" && (
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={200}
                    placeholder="Tell customers why (shown on the storefront)"
                    className="h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-sm text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none"
                  />
                )}

                <div>
                  <p className="text-sm font-medium text-zb-cream">
                    How long do you want to be closed?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setUntil(new Date(Date.now() + 30 * 60_000).toISOString())
                      }
                      className="rounded-full border border-zb-sage/35 px-4 py-1.5 text-sm text-zb-cream transition hover:border-zb-bone"
                    >
                      30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setUntil("")}
                      className="rounded-full border border-zb-sage/35 px-4 py-1.5 text-sm text-zb-cream transition hover:border-zb-bone"
                    >
                      End of slot
                    </button>
                  </div>
                  <label className="mt-3 block text-xs text-zb-cream/55">
                    Or reopen at a specific time (optional)
                    <input
                      type="datetime-local"
                      onChange={(e) =>
                        setUntil(
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : ""
                        )
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-3 text-sm text-zb-cream focus:border-zb-bone focus:outline-none"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setStoreClosed({
                        reasonCode: reason,
                        note: note || undefined,
                        until: until || null,
                      })
                    )
                  }
                  className="w-full rounded-xl bg-zb-danger py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  Close the webstore
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-zb-danger/45 bg-zb-danger/10 px-4 py-2 text-sm text-zb-cream">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
