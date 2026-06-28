"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Globe,
  Minus,
  Plus,
  Store,
  X,
  Zap,
} from "lucide-react";
import { Select } from "@base-ui/react/select";
import {
  setHighDemand,
  setPhysicalStatus,
  setWebstoreStatus,
} from "@/app/workspace/availability/actions";
import { DurationPicker } from "@/components/admin/DurationPicker";
import {
  resolveClosedUntil,
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_MAX_MINUTES,
  HIGH_DEMAND_MIN_MINUTES,
  HIGH_DEMAND_STEP_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
  type ClosureReasonCode,
  type DurationChoice,
  type StoreAvailability,
} from "@/lib/store-availability";

const REASONS: { value: ClosureReasonCode; label: string }[] = [
  { value: "end_of_hours", label: "End of operating hours" },
  { value: "maintenance", label: "Temporary maintenance" },
  { value: "staff", label: "Staff unavailable" },
  { value: "inventory", label: "Inventory shortage" },
  { value: "emergency", label: "Emergency issue" },
  { value: "high_volume", label: "High order volume" },
  { value: "custom", label: "Custom reason" },
];

const inputClass =
  "h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-sm text-zb-cream placeholder:text-zb-cream/40 transition focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/30";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-zb-bone/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zb-primary-strong";

type StatusTone = "open" | "closed" | "demand";

function StatusPill({
  tone,
  children,
}: {
  tone: StatusTone;
  children: React.ReactNode;
}) {
  const styles: Record<StatusTone, { wrap: string; dot: string }> = {
    open: {
      wrap: "border-emerald-400/30 bg-emerald-400/12 text-emerald-300",
      dot: "bg-emerald-400",
    },
    closed: {
      wrap: "border-zb-danger/40 bg-zb-danger/15 text-red-300",
      dot: "bg-zb-danger",
    },
    demand: {
      wrap: "border-zb-bone/45 bg-zb-bone/15 text-zb-bone-soft",
      dot: "bg-zb-bone",
    },
  };
  const s = styles[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${s.wrap}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {children}
    </span>
  );
}

function ReasonSelect({
  value,
  onChange,
  disabled,
}: {
  value: ClosureReasonCode;
  onChange: (v: ClosureReasonCode) => void;
  disabled?: boolean;
}) {
  return (
    <Select.Root
      items={REASONS}
      value={value}
      onValueChange={(v) => onChange(v as ClosureReasonCode)}
      disabled={disabled}
    >
      <Select.Trigger className="group flex h-12 w-full items-center rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-left text-sm text-zb-cream outline-none transition hover:border-zb-sage focus-visible:ring-2 focus-visible:ring-zb-bone/40 data-[popup-open]:border-zb-bone">
        <Select.Value placeholder="Choose a reason" className="flex-1" />
        <ChevronDown className="ml-3 size-4 text-zb-cream/50 transition group-data-[popup-open]:rotate-180" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          className="z-[70]"
        >
          <Select.Popup className="zb-modal-scroll max-h-72 w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-zb-sage/30 bg-zb-primary-strong p-1 text-zb-cream shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] outline-none">
            <Select.List>
              {REASONS.map((r) => (
                <Select.Item
                  key={r.value}
                  value={r.value}
                  className="flex h-9 cursor-default items-center justify-between gap-3 rounded-lg px-3 text-sm text-zb-cream/70 outline-none transition-colors data-[highlighted]:bg-zb-sage/20 data-[highlighted]:text-zb-cream data-[selected]:font-medium data-[selected]:text-zb-bone-soft"
                >
                  <Select.ItemText className="truncate">{r.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="size-4 text-zb-bone" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function StoreAvailabilityModal({
  state,
  onClose,
}: {
  state: StoreAvailability;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [webEditing, setWebEditing] = useState(false);
  const [webReason, setWebReason] = useState<ClosureReasonCode>(
    state.closureReasonCode ?? "end_of_hours"
  );
  const [webNote, setWebNote] = useState(state.closureNote ?? "");
  const [webDuration, setWebDuration] = useState<DurationChoice>({ kind: "manual" });

  const [physEditing, setPhysEditing] = useState(false);
  const [alsoWebstore, setAlsoWebstore] = useState(false);
  const [physReason, setPhysReason] = useState<ClosureReasonCode>(
    state.physicalReasonCode ?? "end_of_hours"
  );
  const [physNote, setPhysNote] = useState(state.physicalNote ?? "");
  const [physDuration, setPhysDuration] = useState<DurationChoice>({ kind: "manual" });

  const [minutes, setMinutes] = useState(
    state.prepBufferMinutes || HIGH_DEMAND_DEFAULT_MINUTES
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock the page behind the modal so its native scrollbar doesn't show
  // through the translucent backdrop. Compensate for the removed scrollbar
  // width to avoid a layout shift on open/close.
  useEffect(() => {
    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else {
        router.refresh();
        onClose();
      }
    });
  }

  function resolveOrError(choice: DurationChoice): string | null | undefined {
    const r = resolveClosedUntil(choice);
    if (!r.ok) {
      setError(r.error);
      return undefined;
    }
    return r.value;
  }

  function submitWebstoreClose() {
    const until = resolveOrError(webDuration);
    if (until === undefined && webDuration.kind === "specific") return;
    run(() =>
      setWebstoreStatus({
        open: false,
        reasonCode: webReason,
        note: webReason === "custom" ? webNote || undefined : undefined,
        until: until ?? null,
      })
    );
  }

  function submitPhysicalClose() {
    const until = resolveOrError(physDuration);
    if (until === undefined && physDuration.kind === "specific") return;
    let webstore:
      | {
          reasonCode: ClosureReasonCode;
          note?: string;
          until: string | null;
        }
      | undefined;
    if (alsoWebstore) {
      webstore = {
        reasonCode: physReason,
        note: physReason === "custom" ? physNote || undefined : undefined,
        until: until ?? null,
      };
    }
    run(() =>
      setPhysicalStatus({
        open: false,
        reasonCode: physReason,
        note: physReason === "custom" ? physNote || undefined : undefined,
        until: until ?? null,
        webstore,
      })
    );
  }

  const demandDisabled = pending || !state.isOpen;

  return (
    <div
      className="zb-modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Update store status"
        className="zb-modal-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-zb-sage/25 bg-zb-primary-strong shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.7)] sm:rounded-3xl sm:shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-zb-sage/15 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-none tracking-tight text-zb-cream">
              Store status
            </h2>
            <p className="mt-2 text-sm text-zb-cream/60">
              Control walk-in service and online ordering.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={`grid size-9 shrink-0 place-items-center rounded-full border border-zb-sage/25 text-zb-cream/60 transition hover:border-zb-sage/50 hover:bg-zb-primary hover:text-zb-cream ${focusRing}`}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="zb-modal-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {/* Physical store */}
          <ServiceCard
            icon={<Store className="size-[1.15rem]" />}
            title="Walk-in café"
            isOpen={state.physicalOpen}
            openCopy="Serving walk-in customers"
            closedCopy={state.physicalLabel ?? "Closed for walk-ins"}
            onReopen={() => run(() => setPhysicalStatus({ open: true }))}
            editing={physEditing}
            onToggleEdit={() => setPhysEditing((v) => !v)}
            closeLabel="Close café"
            pending={pending}
          >
            <div className="space-y-3">
              <ReasonSelect value={physReason} onChange={setPhysReason} disabled={pending} />
              {physReason === "custom" && (
                <input
                  value={physNote}
                  onChange={(e) => setPhysNote(e.target.value)}
                  maxLength={200}
                  placeholder="Tell customers why (shown on the storefront)"
                  className={inputClass}
                />
              )}
              <DurationPicker value={physDuration} onChange={setPhysDuration} disabled={pending} />

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zb-sage/25 bg-zb-primary-dark/40 p-3 transition hover:border-zb-sage/45">
                <input
                  type="checkbox"
                  checked={alsoWebstore}
                  onChange={(e) => setAlsoWebstore(e.target.checked)}
                  className="mt-0.5 size-4 accent-zb-bone"
                />
                <span className="text-sm leading-snug text-zb-cream">
                  Also pause online ordering
                  <span className="mt-0.5 block text-xs text-zb-cream/55">
                    {alsoWebstore
                      ? "The same reason and reopening time apply to the webstore."
                      : "The webstore stays open unless you turn this on."}
                  </span>
                </span>
              </label>

              <ConfirmCloseButton
                pending={pending}
                onClick={submitPhysicalClose}
                label={alsoWebstore ? "Close café & webstore" : "Close café"}
              />
            </div>
          </ServiceCard>

          {/* Webstore */}
          <ServiceCard
            icon={<Globe className="size-[1.15rem]" />}
            title="Online ordering"
            isOpen={state.isOpen}
            statusPill={
              state.isOpen && state.highDemand ? (
                <StatusPill tone="demand">High demand</StatusPill>
              ) : undefined
            }
            openCopy={
              state.highDemand
                ? "Open with extended prep time"
                : "Accepting online orders"
            }
            closedCopy={state.closureLabel ?? "Online ordering paused"}
            onReopen={() => run(() => setWebstoreStatus({ open: true }))}
            editing={webEditing}
            onToggleEdit={() => setWebEditing((v) => !v)}
            closeLabel="Pause ordering"
            pending={pending}
          >
            <div className="space-y-3">
              <ReasonSelect value={webReason} onChange={setWebReason} disabled={pending} />
              {webReason === "custom" && (
                <input
                  value={webNote}
                  onChange={(e) => setWebNote(e.target.value)}
                  maxLength={200}
                  placeholder="Tell customers why (shown on the storefront)"
                  className={inputClass}
                />
              )}
              <DurationPicker value={webDuration} onChange={setWebDuration} disabled={pending} />
              <ConfirmCloseButton
                pending={pending}
                onClick={submitWebstoreClose}
                label="Pause online ordering"
              />
            </div>
          </ServiceCard>

          {/* High demand mode */}
          <section
            className={`rounded-2xl border p-4 transition ${
              state.highDemand
                ? "zb-demand-active border-zb-bone/50 bg-zb-bone/[0.08]"
                : "border-zb-sage/25 bg-zb-primary-dark/35"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl border transition ${
                    state.highDemand
                      ? "border-zb-bone/40 bg-zb-bone/15 text-zb-bone-soft"
                      : "border-zb-sage/25 bg-zb-primary-dark/60 text-zb-cream/70"
                  }`}
                >
                  <Zap className="size-[1.15rem]" />
                </span>
                <div className="min-w-0">
                  <span className="block font-semibold text-zb-cream">High demand</span>
                  <span className="mt-0.5 block text-sm leading-snug text-zb-cream/60">
                    Stay open and add prep time to new orders
                  </span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.highDemand}
                aria-label="High demand mode"
                disabled={demandDisabled}
                onClick={() =>
                  state.highDemand
                    ? run(() => setHighDemand({ enabled: false }))
                    : run(() => setHighDemand({ enabled: true, minutes }))
                }
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                  state.highDemand ? "bg-emerald-500" : "bg-zb-primary/50"
                } disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-white shadow transition-[left] duration-200 ${
                    state.highDemand ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {state.isOpen ? (
              <div className="mt-4 border-t border-zb-sage/15 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zb-cream">Extra prep time</p>
                  <div className="inline-flex items-center rounded-2xl border border-zb-sage/30 bg-zb-primary-dark/55 p-1">
                    <button
                      type="button"
                      aria-label="Decrease extra time"
                      disabled={pending || minutes <= HIGH_DEMAND_MIN_MINUTES}
                      onClick={() =>
                        setMinutes((m) =>
                          Math.max(HIGH_DEMAND_MIN_MINUTES, m - HIGH_DEMAND_STEP_MINUTES)
                        )
                      }
                      className={`grid size-9 place-items-center rounded-xl text-zb-cream transition hover:bg-zb-sage/20 disabled:opacity-30 disabled:hover:bg-transparent ${focusRing}`}
                    >
                      <Minus className="size-4" />
                    </button>
                    <div className="flex min-w-[4.5rem] items-baseline justify-center gap-1">
                      <span className="font-display text-2xl leading-none text-zb-cream">
                        {minutes}
                      </span>
                      <span className="text-xs text-zb-cream/55">min</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Increase extra time"
                      disabled={pending || minutes >= HIGH_DEMAND_MAX_MINUTES}
                      onClick={() =>
                        setMinutes((m) =>
                          Math.min(HIGH_DEMAND_MAX_MINUTES, m + HIGH_DEMAND_STEP_MINUTES)
                        )
                      }
                      className={`grid size-9 place-items-center rounded-xl text-zb-cream transition hover:bg-zb-sage/20 disabled:opacity-30 disabled:hover:bg-transparent ${focusRing}`}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-zb-cream/50">
                  Applies to new orders for the next {HIGH_DEMAND_WINDOW_MINUTES} minutes.
                  Orders already placed keep their original prep time.
                </p>
                {state.highDemand && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setHighDemand({ enabled: true, minutes }))}
                    className={`mt-3 w-full rounded-xl border border-zb-bone/45 py-2.5 text-sm font-semibold text-zb-bone-soft transition hover:bg-zb-bone/10 disabled:opacity-50 ${focusRing}`}
                  >
                    Update extra time
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-4 border-t border-zb-sage/15 pt-4 text-xs leading-5 text-zb-cream/45">
                Reopen online ordering to adjust high-demand prep time.
              </p>
            )}
          </section>

          {error && (
            <p
              role="alert"
              className="zb-reveal rounded-xl border border-zb-danger/45 bg-zb-danger/10 px-4 py-3 text-sm text-zb-cream"
            >
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  isOpen,
  openCopy,
  closedCopy,
  statusPill,
  onReopen,
  editing,
  onToggleEdit,
  closeLabel,
  pending,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  openCopy: string;
  closedCopy: string;
  statusPill?: React.ReactNode;
  onReopen: () => void;
  editing: boolean;
  onToggleEdit: () => void;
  closeLabel: string;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-4 transition ${
        isOpen
          ? "border-zb-sage/25 bg-zb-primary-dark/35"
          : "border-zb-danger/30 bg-zb-danger/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl border transition ${
              isOpen
                ? "border-zb-sage/25 bg-zb-primary-dark/60 text-zb-cream/80"
                : "border-zb-danger/30 bg-zb-danger/10 text-red-300"
            }`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-zb-cream">{title}</span>
              {statusPill ??
                (isOpen ? (
                  <StatusPill tone="open">Open</StatusPill>
                ) : (
                  <StatusPill tone="closed">Closed</StatusPill>
                ))}
            </div>
            <p className="mt-1 text-sm leading-snug text-zb-cream/60">
              {isOpen ? openCopy : closedCopy}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        {isOpen ? (
          <button
            type="button"
            disabled={pending}
            onClick={onToggleEdit}
            aria-expanded={editing}
            className={`w-full rounded-xl border py-2.5 text-sm font-semibold transition disabled:opacity-50 ${focusRing} ${
              editing
                ? "border-zb-sage/40 bg-zb-primary-dark/50 text-zb-cream/80 hover:bg-zb-primary-dark/70"
                : "border-zb-bone/40 text-zb-bone-soft hover:border-zb-bone hover:bg-zb-bone/10"
            }`}
          >
            {editing ? "Cancel" : closeLabel}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={onReopen}
            className={`w-full rounded-xl bg-emerald-500/90 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50 ${focusRing}`}
          >
            Reopen
          </button>
        )}
      </div>

      {isOpen && editing && <div className="zb-reveal mt-4">{children}</div>}
    </section>
  );
}

function ConfirmCloseButton({
  pending,
  onClick,
  label,
}: {
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`w-full rounded-xl bg-zb-danger py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 ${focusRing} focus-visible:ring-zb-danger/60`}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
