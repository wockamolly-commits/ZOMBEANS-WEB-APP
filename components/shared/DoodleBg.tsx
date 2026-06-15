import { cn } from "@/lib/utils";

/**
 * Tiled doodle pattern overlay. Used as section accent only — never
 * full-bleed behind body copy. Renders as a positioned ::before via
 * the `zb-doodle-overlay` class in globals.css.
 */
export function DoodleBg({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("zb-doodle-overlay relative isolate", className)}>
      {children}
    </div>
  );
}
