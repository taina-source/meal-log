export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}
export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}
export function relativeDate(date: string): string {
  return date === localDate() ? '今日' : date === shiftDate(localDate(), -1) ? '昨日' : formatDate(date);
}
export function dayBounds(date: string): [string, string] {
  return [new Date(`${date}T00:00:00`).toISOString(), new Date(`${shiftDate(date, 1)}T00:00:00`).toISOString()];
}
