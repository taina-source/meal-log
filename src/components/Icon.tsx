import type { MealType } from '../domain/types';
export type IconName = 'home' | 'history' | 'plus' | 'analysis' | 'settings' | 'chevron-left' | 'chevron-right' | 'close' | 'leaf' | 'scale' | 'check' | 'edit' | 'trash' | MealType;
const paths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  history: 'M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  analysis: 'M5 20v-6M12 20V4M19 20V9',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  'chevron-left': 'm14 6-6 6 6 6', 'chevron-right': 'm10 6 6 6-6 6', close: 'm6 6 12 12M18 6 6 18',
  leaf: 'M20 4C9 2 3 7 5 14c2 7 15 5 15-10ZM5 21 15 10',
  scale: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM8 8h8l-1 5H9ZM12 9v3',
  check: 'm5 12 4 4L19 6', edit: 'm15 4 5 5M4 20l5-1L21 7l-4-4L5 15z', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  breakfast: 'M3 18h18M5 14a7 7 0 0 1 14 0M12 2v3M3 6l2 2M21 6l-2 2',
  lunch: 'M8 3v6M5 3v5a3 3 0 0 0 6 0V3M8 11v10M19 3c-4 2-4 8 0 9V3ZM19 12v9',
  dinner: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  snack: 'M4 9h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9ZM17 10h2a3 3 0 0 1 0 6h-2M7 3v3M12 3v3',
};
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
