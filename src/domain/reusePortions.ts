import { positive } from './foods';
import type { Nutrients } from './types';

// Same bounds as recipe fractions and existing quantity editors.
export const maxReuseFactor = 100;
export const maxReuseQuantity = 10000;
type NullableNutrients = { [K in keyof Nutrients]: number | null };
export function scaleSavedPortion<T extends NullableNutrients & { quantity?: number }>(original: T, factor: number): T {
  positive(factor, '前回量に対する倍率', maxReuseFactor);
  const next = { ...original };
  for (const key of ['calories', 'protein', 'fat', 'carbs'] as const) {
    const value = original[key];
    if (value === null) { next[key] = null; continue; }
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(value * factor)) throw new Error('保存済み栄養値または倍率を確認してください。');
    next[key] = value * factor;
  }
  if (original.quantity !== undefined) next.quantity = positive(positive(original.quantity, '前回量') * factor, '今回量', maxReuseQuantity);
  return next;
}
export function reuseFactor(originalQuantity: number | undefined, input: string): number {
  if (!input.trim()) throw new Error('今回量を入力してください。');
  const quantity = positive(Number(input), '今回量', originalQuantity === undefined ? maxReuseFactor : maxReuseQuantity);
  return positive(originalQuantity === undefined ? quantity : quantity / positive(originalQuantity, '前回量'), '前回量に対する倍率', maxReuseFactor);
}
