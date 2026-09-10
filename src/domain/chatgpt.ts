import { mealTypes, type MealInput, type Nutrients } from './types';
import { validateMeal } from './validation';

export const nutrientKeys = ['calories', 'protein', 'fat', 'carbs'] as const;
export const nutrientLabels = { calories: 'カロリー', protein: 'P たんぱく質', fat: 'F 脂質', carbs: 'C 炭水化物' };
export interface ChatgptItem {
  name: string; restaurant: string; quantity: number; unit: string;
  calories: number | null; protein: number | null; fat: number | null; carbs: number | null;
  sourceType: 'official' | 'estimate'; sourceUrl: string; sourceTitle: string;
  confidence: 'high' | 'medium' | 'low'; notes: string;
}
export type ChatgptInputType = 'text' | 'photo';
export interface ChatgptPayload { schemaVersion: 1; type: 'meal-log-chatgpt'; inputType?: ChatgptInputType; items: ChatgptItem[] }
export interface ChatgptSnapshot extends Omit<ChatgptItem, 'sourceType'> {
  schemaVersion: 1; declaredSourceType: ChatgptItem['sourceType']; importedAt: string; inputType?: ChatgptInputType;
}
export interface ImportReceipt { payload?: ChatgptPayload; error?: string; importedAt: string }
export const pasteLimit = 128 * 1024;
export const fragmentLimit = 16 * 1024;
export const importError = 'ChatGPTから受け取ったデータを読み込めませんでした。';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSONオブジェクトが必要です。');
  return value as Record<string, unknown>;
}
function textField(row: Record<string, unknown>, key: string, max: number, fallback = ''): string {
  const value = row[key] === undefined ? fallback : row[key];
  if (typeof value !== 'string' || value.length > max) throw new Error(`${key}は${max}文字以内の文字列にしてください。`);
  if (/data:image\//i.test(value)) throw new Error('画像データは取り込めません。栄養情報JSONだけを貼り付けてください。');
  return value.trim();
}
function numberField(value: unknown, key: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${key}は0以上の有限の数値にしてください。`);
  return value;
}
export function normalizeChatgptItem(value: unknown): ChatgptItem {
  const row = record(value);
  const name = textField(row, 'name', 100);
  if (!name) throw new Error('商品名を入力してください。');
  const quantity = numberField(row.quantity === undefined ? 1 : row.quantity, 'quantity');
  if (quantity === null || quantity <= 0) throw new Error('数量は0より大きい数値にしてください。');
  if (row.sourceType !== 'official' && row.sourceType !== 'estimate') throw new Error('sourceTypeはofficialまたはestimateにしてください。');
  if (typeof row.confidence !== 'string' || !['high', 'medium', 'low'].includes(row.confidence)) throw new Error('confidenceはhigh / medium / lowにしてください。');
  return { name, restaurant: textField(row, 'restaurant', 100), quantity, unit: textField(row, 'unit', 30, '個'),
    calories: numberField(row.calories, 'calories'), protein: numberField(row.protein, 'protein'), fat: numberField(row.fat, 'fat'), carbs: numberField(row.carbs, 'carbs'),
    sourceType: row.sourceType, confidence: row.confidence as ChatgptItem['confidence'], sourceUrl: textField(row, 'sourceUrl', 2048), sourceTitle: textField(row, 'sourceTitle', 200), notes: textField(row, 'notes', 2000) };
}
export function parseChatgptJson(text: string): ChatgptPayload {
  if (text.length > pasteLimit || new TextEncoder().encode(text).length > pasteLimit) throw new Error('JSONが長すぎます。128KiB以内・20商品以内に分けてください。');
  const value = record(JSON.parse(text));
  const inputType = validateInputType(value.inputType);
  // An envelope with an unknown version/type must never fall back to legacy parsing.
  const envelope = 'schemaVersion' in value || 'type' in value || 'items' in value;
  if (envelope && (value.schemaVersion !== 1 || value.type !== 'meal-log-chatgpt')) throw new Error('対応していないschemaVersionまたはtypeです。');
  const items = envelope ? value.items : [value];
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new Error('itemsは1〜20件にしてください。');
  return { schemaVersion: 1, type: 'meal-log-chatgpt', ...(inputType ? { inputType } : {}), items: items.map(normalizeChatgptItem) };
}
export function validateInputType(value: unknown): ChatgptInputType | undefined {
  if (value === undefined || value === 'text' || value === 'photo') return value;
  throw new Error('inputTypeはtextまたはphotoにしてください。');
}
export function readChatgptJson(text: string): ImportReceipt {
  const importedAt = new Date().toISOString();
  try { return { payload: parseChatgptJson(text), importedAt }; }
  catch (error) { return { error: `${importError} ${error instanceof SyntaxError ? 'JSONの形式を確認してください。' : error instanceof Error ? error.message : ''}`, importedAt }; }
}
export function consumeImportFragment(target: Pick<Window, 'location' | 'history'>): ImportReceipt | null {
  const hash = target.location.hash;
  if (!hash.startsWith('#ml-import=')) return null;
  const importedAt = new Date().toISOString();
  // Clear even malformed/oversized imports before decoding; do not store the JSON in history.state.
  try { target.history.replaceState(target.history.state, '', target.location.pathname + target.location.search); }
  catch { return { error: `${importError} URLを消去できませんでした。URLの#以降を削除し、JSONを貼り直してください。`, importedAt }; }
  if (hash.length > fragmentLimit || new TextEncoder().encode(hash).length > fragmentLimit) return { error: 'URLのデータが長すぎます。クリップボードから読み込んでください。', importedAt };
  try { return readChatgptJson(decodeURIComponent(hash.slice('#ml-import='.length))); }
  catch { return { error: `${importError} URLエンコードを確認し、JSONを貼り直してください。`, importedAt }; }
}
export function safeSourceUrl(value: string): string | null {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function chatgptSourceLabel(item: Pick<ChatgptItem, 'sourceType' | 'sourceUrl'>, inputType?: ChatgptInputType): string {
  return item.sourceType === 'estimate' ? inputType === 'photo' ? 'ChatGPT写真推定' : 'ChatGPT推定' : `ChatGPT経由・公式情報${safeSourceUrl(item.sourceUrl) ? '' : '（出典URLなし）'}`;
}
export const confidenceLabels = { high: '高', medium: '中', low: '低' };
export function chatgptTotals(items: ChatgptItem[]): Nutrients {
  if (items.length < 1 || items.length > 20) throw new Error('商品は1〜20件にしてください。');
  const total: Nutrients = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const item of items) {
    normalizeChatgptItem(item);
    for (const key of nutrientKeys) {
      const value = item[key];
      if (value === null) throw new Error(`${item.name}：${nutrientLabels[key]}を入力してください。不明のまま登録できません。`);
      total[key] += value * item.quantity;
      if (!Number.isFinite(total[key])) throw new Error('数量または栄養値が大きすぎて計算できません。');
    }
  }
  return total;
}
export function chatgptWarnings(item: ChatgptItem): string[] {
  const warnings: string[] = [];
  if (item.sourceType === 'official' && !safeSourceUrl(item.sourceUrl)) warnings.push('出典URLを確認できません。公式情報かどうかを確認してください。');
  if ((item.calories ?? 0) * item.quantity > 5000 || ['protein', 'fat', 'carbs'].some(key => (item[key as keyof Nutrients] ?? 0) * item.quantity > 500)) warnings.push('1商品の栄養値が大きいため、分量・数量を確認してください。');
  if (nutrientKeys.every(key => item[key] !== null)) {
    const pfc = item.protein! * 4 + item.fat! * 9 + item.carbs! * 4;
    if (Math.abs(pfc - item.calories!) > Math.max(100, item.calories! * 0.5)) warnings.push('カロリーとPFCの値に大きな差があります。登録前に確認してください。');
  }
  return warnings;
}
export function chatgptModified(original: ChatgptItem, edited: ChatgptItem): boolean {
  return (['name', 'restaurant', 'quantity', 'unit', ...nutrientKeys] as const).some(key => original[key] !== edited[key]);
}
// History editing keeps the legacy date/name rules but large finite imports remain editable.
export function validateChatgptMeal(input: MealInput): string | undefined {
  for (const key of nutrientKeys) if (!Number.isFinite(input[key]) || input[key] < 0) return `${nutrientLabels[key]}は0以上の有限の数値にしてください。`;
  if (!mealTypes.includes(input.mealType)) return '食事区分を選んでください。';
  return validateMeal({ ...input, calories: 0, protein: 0, fat: 0, carbs: 0 });
}
