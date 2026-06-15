/**
 * Money helpers. We store everything as integer centavos (1/100 of PHP).
 */

export function formatPeso(cents: number, opts: { showCents?: boolean } = {}) {
  const showCents = opts.showCents ?? cents % 100 !== 0;
  const pesos = cents / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(pesos);
}

export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function centsToPesos(cents: number): number {
  return cents / 100;
}
