/** Format date string "2026-02-19" → "02.19.2026" */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${month}.${day}.${year}`;
}
