import { formatPeso } from "@/lib/peso";
import { cn } from "@/lib/utils";

/**
 * Renders a peso price using tabular numerics.
 * Pass `cents` to keep all money math in integer minor units.
 */
export function PesoPrice({
  cents,
  className,
  size = "md",
}: {
  cents: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };
  return (
    <span className={cn("font-mono-tabular text-zb-bone", sizes[size], className)}>
      {formatPeso(cents)}
    </span>
  );
}
