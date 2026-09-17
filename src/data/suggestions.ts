import { db } from './db';
import { registerItems, type MealContext } from './catalogRepository';
import { reuseSavedMeals } from './reuseMeals';
import { editablePart, type SourcePart } from '../domain/suggestionSources';
import type { MealEntry } from '../domain/types';
import { validCandidate } from '../domain/suggestions';
export async function registerSuggestion(parts: SourcePart[], quantities: number[], context: MealContext): Promise<MealEntry[]> {
  if (!parts.length || parts.length !== quantities.length) throw new Error('候補の量を確認してください。');
  const edited = parts.map((p, i) => editablePart(p, quantities[i]));
  if (edited.some(p => !validCandidate(p.nutrients))) throw new Error('栄養値を確認してください。');
  // Reuse source-specific writes inside one transaction: never save half a combination.
  return db.transaction('rw', db.meals, async () => {
    const result: MealEntry[] = [];
    const saved = edited.filter(p => p.source.kind === 'saved');
    if (saved.length) {
      const originals = saved.map(p => { if (p.source.kind !== 'saved') throw new Error('候補が不正です'); return p.source.meal; });
      result.push(...await reuseSavedMeals(originals, originals.map((m, i) => ({ ...m, ...saved[i].nutrients, quantity: saved[i].quantity })), context));
    }
    const setsDone = new Set<string>();
    for (const p of edited) {
      if (p.source.kind === 'catalog') {
        if (p.set && setsDone.has(p.set.id)) continue;
        const members = p.set ? edited.filter(m => m.set?.id === p.set!.id) : [p];
        const items = members.map(m => { if (m.source.kind !== 'catalog') throw new Error('セット内容が不正です'); return { ...m.source.item, quantity: m.quantity, nutrients: m.nutrients }; });
        result.push(...await registerItems(items, context, p.set));
        if (p.set) setsDone.add(p.set.id);
      }
      else if (p.source.kind !== 'saved') throw new Error('この候補は専用の確認画面から登録してください。');
    }
    return result;
  });
}
