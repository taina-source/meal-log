import { positive } from './foods';

/** App input estimates, separate from the MEXT nutrition catalog. */
export interface FoodUnit {
  readonly id: string;
  readonly label: string;
  readonly gramsPerUnit?: number;
  readonly note: string;
}
const definitions: Readonly<Record<string, readonly FoodUnit[]>> = {
  'mext-01083': [{ id: 'go', label: '合', gramsPerUnit: 150, note: '炊飯前・吸水前の米の目安です。' }],
  'mext-01088': [{ id: 'cooked-go', label: '合分（炊飯後）', gramsPerUnit: 340, note: '1合の生米を炊いた後のご飯の目安です。' }],
  'mext-12004': [{ id: 'piece', label: '個', gramsPerUnit: 50, note: '殻を除いた可食部の目安です。サイズにより異なります。' }],
  'mext-12005': [{ id: 'piece', label: '個', gramsPerUnit: 50, note: '殻をむいたゆで卵の可食部の目安です。' }],
  'mext-01026': [{ id: 'slice', label: '枚', note: '商品の表示や実測から、1枚あたりの重量を入力してください。' }],
  'mext-13003': [{ id: 'ml', label: 'mL', gramsPerUnit: 1.03, note: '普通牛乳の密度を約1.03g/mLとした目安です。' }],
  'mext-03003': [{ id: 'tsp', label: '小さじ', gramsPerUnit: 3, note: 'すり切りで量った目安です。' }, { id: 'tbsp', label: '大さじ', gramsPerUnit: 9, note: 'すり切りで量った目安です。' }],
  'mext-14001': [{ id: 'tsp', label: '小さじ', gramsPerUnit: 4, note: '調理に使用した量と実際に摂取した量が異なる場合があります。' }, { id: 'tbsp', label: '大さじ', gramsPerUnit: 12, note: '調理に使用した量と実際に摂取した量が異なる場合があります。' }],
  'mext-17007': [{ id: 'tsp', label: '小さじ', gramsPerUnit: 6, note: '濃口しょうゆの計量目安です。' }, { id: 'tbsp', label: '大さじ', gramsPerUnit: 18, note: '濃口しょうゆの計量目安です。' }],
};

export function foodUnits(foodId: string): readonly FoodUnit[] { return definitions[foodId] ?? []; }

/** Return canonical edible grams; nutrition is scaled by foodNutrients only. */
export function portionGrams(foodId: string, unit: string, quantity: number, gramsPerUnit?: number): number {
  positive(quantity, '数量');
  if (unit === 'g') return quantity;
  if (!foodUnits(foodId).some(option => option.id === unit)) throw new Error('この食品では使用できない単位です。');
  if (gramsPerUnit === undefined) throw new Error('1単位あたりの重量を入力してください。');
  return positive(quantity * positive(gramsPerUnit, '1単位あたりの重量'), '換算後の重量');
}
