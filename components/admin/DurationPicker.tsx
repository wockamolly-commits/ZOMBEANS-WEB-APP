"use client";

import type { DurationChoice } from "@/lib/store-availability";

const PRESETS: { label: string; choice: DurationChoice }[] = [
  { label: "Until I reopen", choice: { kind: "manual" } },
  { label: "Today only", choice: { kind: "today" } },
  { label: "Until tomorrow", choice: { kind: "tomorrow" } },
  { label: "30 min", choice: { kind: "preset", minutes: 30 } },
  { label: "1 hour", choice: { kind: "preset", minutes: 60 } },
  { label: "2 hours", choice: { kind: "preset", minutes: 120 } },
  { label: "4 hours", choice: { kind: "preset", minutes: 240 } },
];

function sameChoice(a: DurationChoice, b: DurationChoice): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "preset" && b.kind === "preset") {
    return a.minutes === b.minutes;
  }
  return a.kind !== "specific";
}

function localNowValue(): string {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

function localValueFromIso(iso: string): string {
  const d = new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function DurationPicker({
  value,
  onChange,
  disabled,
}: {
  value: DurationChoice;
  onChange: (choice: DurationChoice) => void;
  disabled?: boolean;
}) {
  const specificDisabled = disabled || value.kind !== "manual" && value.kind !== "specific";

  return (
    <div>
      <p className="text-sm font-medium text-zb-cream">How long?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = sameChoice(value, p.choice);
          return (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.choice)}
              className={`rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-40 ${
                active
                  ? "border-zb-bone bg-zb-bone/15 text-zb-cream"
                  : "border-zb-sage/35 text-zb-cream/80 hover:border-zb-bone"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <label className="mt-3 block text-xs text-zb-cream/55">
        Or pick a specific day and time
        <input
          type="datetime-local"
          min={localNowValue()}
          disabled={specificDisabled}
          value={value.kind === "specific" ? localValueFromIso(value.iso) : ""}
          onChange={(e) =>
            onChange(
              e.target.value
                ? { kind: "specific", iso: new Date(e.target.value).toISOString() }
                : { kind: "manual" }
            )
          }
          className="mt-1 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-3 text-sm text-zb-cream focus:border-zb-bone focus:outline-none disabled:opacity-40"
        />
      </label>
    </div>
  );
}
