const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Format ISO date as DD MMM YYYY (e.g. 16 May 2026). Never relative. */
export function formatKartaDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = MONTHS[d.getMonth()] ?? "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatKartaDateAdded(iso: string | null | undefined): string {
  const formatted = formatKartaDate(iso);
  return formatted === "—" ? formatted : `Added ${formatted}`;
}
