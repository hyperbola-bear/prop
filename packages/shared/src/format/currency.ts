export function formatSGD(
  cents: number,
  maximumFractionDigits = 0
): string {
  const formatted = new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits
  }).format(cents / 100);

  return formatted.startsWith("$") ? `S${formatted}` : formatted;
}
