import type { Nutrients } from './types';
import { nutrientKeys } from './restaurantMenus';
import { sumNutrients } from './nutrition';
export type SuggestionMode = 'balanced' | 'protein' | 'usual';
export interface SuggestionPart {
  id: string; sourceKey: string; name: string; quantity: number; unitLabel: string;
  nutrients: Nutrients; favorite: boolean; recent: boolean; prepared: boolean; preferred: boolean;
}
export interface Suggestion<T extends SuggestionPart = SuggestionPart> { id: string; parts: T[]; nutrients: Nutrients; score: number }
const weights = { balanced: [0.40, 0.30, 0.15, 0.15], protein: [0.30, 0.45, 0.15, 0.10], usual: [0.40, 0.30, 0.15, 0.15] };
const floors = { calories: 100, protein: 10, fat: 5, carbs: 10 };
export function validCandidate(value: unknown): value is Nutrients {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return nutrientKeys.every(k => typeof record[k] === 'number' && Number.isFinite(record[k]) && (record[k] as number) >= 0) && nutrientKeys.some(k => (record[k] as number) > 0);
}
export function validGoals(goals: Nutrients) { return nutrientKeys.every(k => Number.isFinite(goals[k]) && goals[k] >= 0) && goals.calories > 0; }
export function remainingTargets(goals: Nutrients, consumed: Nutrients): Nutrients {
  return { calories: goals.calories - consumed.calories, protein: goals.protein - consumed.protein, fat: goals.fat - consumed.fat, carbs: goals.carbs - consumed.carbs };
}
export function normalizedError(remaining: number, candidate: number, goal: number, floor: number): number {
  if (![remaining, candidate, goal, floor].every(Number.isFinite) || floor <= 0) return Number.MAX_VALUE;
  const projected = remaining - candidate;
  const result = Math.abs(projected) / Math.max(Math.abs(remaining), Math.max(0, goal) * .10, floor) * (projected < 0 ? 1.35 : 1);
  return Number.isFinite(result) ? result : Number.MAX_VALUE;
}
export function usualFactor(parts: SuggestionPart[]) { return parts.some(p => p.favorite) ? .85 : parts.some(p => p.recent) ? .90 : parts.some(p => p.prepared) ? .95 : 1; }
export function nutritionScore(value: Nutrients, remaining: Nutrients, goals: Nutrients, mode: SuggestionMode) {
  return nutrientKeys.reduce((score, key, i) => score + normalizedError(remaining[key], value[key], goals[key], floors[key]) * weights[mode][i], 0);
}
export function nearGoal(remaining: Nutrients, goals: Nutrients) { return validGoals(goals) && nutrientKeys.every(k => Number.isFinite(remaining[k]) && Math.abs(remaining[k]) <= goals[k] * .10); }
export function allGoalsReached(remaining: Nutrients) { return nutrientKeys.every(k => Number.isFinite(remaining[k]) && remaining[k] <= 0); }
export function discreteGrams(previous?: number) { return [...new Set([...(previous && previous > 0 && Number.isFinite(previous) ? [previous] : []), ...Array.from({ length: 16 }, (_, i) => (i + 1) * 25)])]; }
function compare<T extends SuggestionPart>(a: Suggestion<T>, b: Suggestion<T>) {
  return a.score - b.score || a.parts.length - b.parts.length || usualFactor(a.parts) - usualFactor(b.parts) || Number(b.parts.some(p => p.preferred)) - Number(a.parts.some(p => p.preferred)) || a.id.localeCompare(b.id);
}
export function rankSuggestions<T extends SuggestionPart>(input: T[], remaining: Nutrients, goals: Nutrients, mode: SuggestionMode, combinations = true): Suggestion<T>[] {
  if (!validGoals(goals) || !nutrientKeys.every(k => Number.isFinite(remaining[k]))) return [];
  const make = (parts: T[]): Suggestion<T> => {
    const ordered = [...parts].sort((a, b) => a.id.localeCompare(b.id)), nutrients = sumNutrients(ordered.map(p => p.nutrients));
    return { id: ordered.map(p => p.id).join('|'), parts: ordered, nutrients, score: nutritionScore(nutrients, remaining, goals, mode) * (mode === 'usual' ? usualFactor(ordered) : 1) };
  };
  const singles = [...new Map(input.filter(p => validCandidate(p.nutrients) && Number.isFinite(p.quantity) && p.quantity > 0).sort((a,b) => a.id.localeCompare(b.id)).map(p => [p.id, p])).values()].map(p => make([p])).sort(compare);
  const best = singles.slice(0, 60);
  if (!combinations) return best;
  // At most 24 distinct source items, at most 2 portions each: <= 17,344 triples.
  const groups = new Map<string, T[]>();
  for (const single of singles) { const p = single.parts[0]; if (!groups.has(p.sourceKey) && groups.size < 24) groups.set(p.sourceKey, []); const g = groups.get(p.sourceKey); if (g && g.length < 2) g.push(p); }
  const pool = [...groups.values()];
  const retain = (parts: T[]) => { const next = make(parts); if (best.length < 60 || compare(next, best[best.length - 1]) < 0) { best.push(next); best.sort(compare); if (best.length > 60) best.pop(); } };
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    for (const a of pool[i]) for (const b of pool[j]) retain([a, b]);
    for (let k = j + 1; k < pool.length; k++) for (const a of pool[i]) for (const b of pool[j]) for (const c of pool[k]) retain([a, b, c]);
  }
  return best;
}
export function suggestionSections<T extends SuggestionPart>(parts: T[], remaining: Nutrients, goals: Nutrients) {
  const used = new Set<string>();
  return (['balanced', 'protein', 'usual'] as const).map(mode => {
    const candidates = rankSuggestions(parts, remaining, goals, mode).filter(c => !used.has(c.id)).slice(0, 5);
    candidates.forEach(c => used.add(c.id)); return { mode, candidates };
  });
}
