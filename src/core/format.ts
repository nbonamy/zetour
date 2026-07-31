const LARGE_NUMBER_SUFFIXES = [
  "",
  "K",
  "M",
  "B",
  "T",
  "Qa",
  "Qi",
  "Sx",
  "Sp",
  "Oc",
  "No",
  "Dc",
] as const;

export const formatCompactNumber = (
  value: number,
  maximumFractionDigits = 1,
): string => {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "0";
  const absolute = Math.abs(value);
  if (absolute < 1_000) {
    return new Intl.NumberFormat("en", {
      maximumFractionDigits:
        absolute < 10 ? Math.max(0, maximumFractionDigits) : 0,
    }).format(value);
  }

  const magnitude = Math.floor(Math.log10(absolute) / 3);
  if (magnitude >= LARGE_NUMBER_SUFFIXES.length) {
    return value.toExponential(Math.max(0, maximumFractionDigits));
  }

  const scaled = value / 1_000 ** magnitude;
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits,
  }).format(scaled)}${LARGE_NUMBER_SUFFIXES[magnitude]}`;
};

export const formatMultiplier = (value: number): string =>
  `×${formatCompactNumber(value, value < 100 ? 2 : 1)}`;
