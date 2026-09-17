export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("lt-LT", { style: "currency", currency }).format(
    cents / 100
  );
}
