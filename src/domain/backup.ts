import type { Favorite, MealSet, Recipe } from './catalog';
import type { MealEntry, UserSettings, WeightEntry } from './types';
import { validateMeal, validateSettings, validLocalDateTime } from './validation';
import { normalizeChatgptItem, validateChatgptMeal, validateInputType } from './chatgpt';
import { measurementValues, validateMeasurements, measurementFields } from './measurements';
import { localDate, localTime } from './date';

export const backupLimit = 50 * 1024 * 1024;
export const backupTables = ['meals', 'weights', 'settings', 'recipes', 'favorites', 'mealSets'] as const;
export interface BackupData {
  meals: MealEntry[]; weights: WeightEntry[]; settings: (UserSettings & { id: string })[];
  recipes: Recipe[]; favorites: Favorite[]; mealSets: MealSet[];
}
export interface Backup { type: 'meal-log-backup'; formatVersion: 1; dbVersion: 3; exportedAt: string; app: { name: 'Meal Log' }; data: BackupData }
type Row = Record<string, unknown>;
const fail = (message = '記録の形式が正しくありません。'): never => { throw new Error(message); };
function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(); return value as Row; }
function text(value: unknown, nonempty = false): string { if (typeof value !== 'string' || (nonempty && !value.trim())) return fail(); return value; }
function number(value: unknown, min = 0): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min) return fail(); return value; }
function positive(value: unknown) { if (number(value) <= 0) fail(); }
function list(value: unknown): unknown[] { if (!Array.isArray(value)) return fail(); return value; }
function strings(value: unknown) { list(value).forEach(v => text(v)); }
function oneOf(value: unknown, allowed: string[]) { if (typeof value !== 'string' || !allowed.includes(value)) fail(); }
function timestamp(value: unknown) {
  const v = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v)) || !validLocalDateTime(v.slice(0, 10), v.slice(11, 16))) fail('日付・日時の形式が正しくありません。');
}
function nutrients(value: unknown, nullable = false) { const row = object(value); for (const key of ['calories', 'protein', 'fat', 'carbs']) if (!(nullable && row[key] === null)) number(row[key]); }
function optional(row: Row, key: string, check: (value: unknown) => void) { if (row[key] !== undefined) check(row[key]); }
function nullableSnapshot(row: Row, key: string, check: (value: unknown) => void) { if (row[key] !== undefined && row[key] !== null) check(row[key]); }
function base(row: Row, updated = false) { text(row.id, true); timestamp(row.createdAt); if (updated) timestamp(row.updatedAt); }
function recipe(value: unknown) {
  const row = object(value); base(row, true); text(row.name, true); positive(row.servings);
  const ingredients = list(row.ingredients); if (!ingredients.length) fail();
  ingredients.forEach(value => { const i = object(value); text(i.id, true); text(i.foodId, true); text(i.name, true); positive(i.grams); nutrients(i.per100g); text(i.sourceVersion); strings(i.notes); });
}
function provenance(value: unknown) {
  const row = object(value);
  for (const key of ['calories', 'protein', 'fat', 'carbs']) {
    const p = object(row[key]); if (p.value !== null) number(p.value);
    oneOf(p.sourceType, ['official', 'official_old', 'secondary', 'estimate', 'unknown']);
    const url = text(p.sourceUrl); if (url) { let parsed: URL; try { parsed = new URL(url); } catch { return fail('出典URLの形式が正しくありません。'); } if (!['https:', 'http:'].includes(parsed.protocol)) fail('安全でない出典URLが含まれています。'); }
    text(p.sourceTitle); text(p.retrievedAt, true); if (p.publishedOrUpdatedAt !== null) text(p.publishedOrUpdatedAt); strings(p.notes);
  }
}
function restaurantSnapshot(value: unknown) {
  const row = object(value); text(row.id, true); text(row.restaurantId, true); text(row.name, true); nutrients(row, true);
  provenance(row.nutrientProvenance); const raw = object(row.rawNutrients); for (const k of ['calories', 'protein', 'fat', 'carbs']) text(raw[k]);
  strings(row.notes); optional(row, 'aliases', strings); optional(row, 'quantityUnit', v => text(v)); optional(row, 'servingBasis', v => text(v));
}
function chatSnapshot(value: unknown) {
  const row = object(value); if (row.schemaVersion !== 1) fail(); timestamp(row.importedAt); validateInputType(row.inputType);
  // Validate only; never use normalized/trimmed values to rewrite the original snapshot.
  normalizeChatgptItem({ ...row, sourceType: row.declaredSourceType });
}
function meal(value: unknown) {
  const row = object(value); base(row, true); text(row.name, true); text(row.restaurant); nutrients(row); timestamp(row.eatenAt);
  oneOf(row.sourceType, ['manual','official','official_old','secondary','database','estimate','ai_estimate','barcode','recipe','chatgpt']);
  if (row.confidence !== null) number(row.confidence);
  const error = (row.sourceType === 'chatgpt' ? validateChatgptMeal : validateMeal)(row as unknown as MealEntry); if (error) fail(error);
  optional(row, 'quantity', positive); optional(row, 'unit', v => oneOf(v, ['g','whole','item'])); optional(row, 'notes', strings);
  for (const k of ['sourceId','sourceVersion','chatgptImportId','chatgptUnit','restaurantId','restaurantName','restaurantOrderId','setId','setName','setRunId','copiedFromId','copyTargetDate']) optional(row, k, v => text(v));
  for (const k of ['chatgptUserModified','chatgptModifiedBeforeSave','manuallyEditedNutrition']) optional(row, k, v => { if (typeof v !== 'boolean') fail(); });
  nullableSnapshot(row, 'chatgptSnapshot', chatSnapshot); nullableSnapshot(row, 'restaurantSnapshot', restaurantSnapshot); nullableSnapshot(row, 'recipeSnapshot', recipe); nullableSnapshot(row, 'nutrientProvenance', provenance);
}
function measurement(value: unknown) {
  const row = object(value); base(row); if (!validLocalDateTime(text(row.date), '12:00')) fail();
  // Validate both legacy and new values, while leaving legacy weight fields untouched.
  for (const key of ['weight', ...measurementFields]) optional(row, key, positive);
  const error = validateMeasurements(measurementValues(row as unknown as WeightEntry)); if (error) fail(error);
  optional(row, 'healthExport', value => { const meta = object(value); for (const field of measurementFields) optional(meta, field, value => { const m = object(value); positive(m.value); timestamp(m.exportedAt); }); });
}
function settings(value: unknown) {
  const row = object(value); if (row.id !== 'user') fail('設定のIDが正しくありません。');
  oneOf(row.theme, ['system','light','dark']); if (typeof row.showPfcDecimals !== 'boolean') fail();
  optional(row, 'quickPfcPercentages', v => { const p = object(v); for (const k of ['protein','fat','carbs']) number(p[k]); });
  const error = validateSettings(row as unknown as UserSettings); if (error) fail(error);
}
function setItem(value: unknown) {
  const row = object(value); text(row.id, true); text(row.sourceId, true); text(row.name, true); positive(row.quantity); nutrients(row.nutrients);
  oneOf(row.kind, ['food','recipe','restaurant']); oneOf(row.unit, ['g','whole']); optional(row, 'notes', strings); nullableSnapshot(row, 'recipeSnapshot', recipe);
}
function set(value: unknown) { const row = object(value); base(row, true); text(row.name, true); nutrients(row.total); const items = list(row.items); if (!items.length) fail(); items.forEach(setItem); }
function favorite(value: unknown) {
  const row = object(value); base(row); text(row.sourceId, true); positive(row.quantity); oneOf(row.kind, ['food','recipe','set','restaurant','restaurantMenu','chatgptMeal','manualMeal']);
  nullableSnapshot(row, 'mealSnapshot', meal);
  if ((row.kind === 'chatgptMeal' || row.kind === 'manualMeal') && !row.mealSnapshot) fail('お気に入りの保存内容がありません。');
}
// Preserve unknown optional JSON fields, but reject non-JSON values and dangerous keys.
function safeJson(value: unknown, depth = 0): void {
  if (depth > 64) fail('データの入れ子が深すぎます。');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(); return; }
  if (Array.isArray(value)) { value.forEach(v => safeJson(v, depth + 1)); return; }
  const row = object(value);
  for (const [key, v] of Object.entries(row)) { if (['__proto__','prototype','constructor'].includes(key)) fail('対応していないキーが含まれています。'); safeJson(v, depth + 1); }
}
export function checkBackupSize(bytes: number) { if (!Number.isFinite(bytes) || bytes < 0 || bytes > backupLimit) fail('バックアップは50MiB以下のJSONファイルを選んでください。'); }
export function validateBackup(value: unknown): Backup {
  safeJson(value); const root = object(value);
  if (root.type !== 'meal-log-backup') fail('Meal Logのバックアップファイルではありません。');
  if (root.formatVersion !== 1 || root.dbVersion !== 3) fail('対応していないバックアップ形式またはDBバージョンです。');
  timestamp(root.exportedAt); if (object(root.app).name !== 'Meal Log') fail();
  const data = object(root.data);
  const validators = { meals: meal, weights: measurement, settings, recipes: recipe, favorites: favorite, mealSets: set };
  for (const table of backupTables) {
    const rows = list(data[table]), ids = new Set<string>();
    for (const [index, value] of rows.entries()) {
      try { validators[table](value); const id = text(object(value).id); if (ids.has(id)) fail('IDが重複しています。'); ids.add(id); }
      catch (error) { fail(`${table}の${index + 1}件目：${error instanceof Error ? error.message : '形式が正しくありません。'}`); }
    }
  }
  const dates = (data.weights as Row[]).map(row => row.date);
  if (new Set(dates).size !== dates.length) fail('身体測定の日付が重複しています。');
  if ((data.settings as unknown[]).length > 1) fail('設定が重複しています。');
  const result = structuredClone(value) as Backup;
  result.data.settings.forEach(row => { delete row.pendingHealthExport; });
  return result;
}
export function parseBackup(text: string): Backup {
  checkBackupSize(text.length); checkBackupSize(new TextEncoder().encode(text).byteLength);
  let value: unknown; try { value = JSON.parse(text); } catch { return fail('JSONを読み込めませんでした。ファイルを確認してください。'); }
  return validateBackup(value);
}
export function makeBackup(data: BackupData, exportedAt: string): Backup {
  // JSON round trip only removes non-persistent undefined properties, not stored values.
  const copied = structuredClone(data); copied.settings.forEach(row => { delete row.pendingHealthExport; });
  return validateBackup(JSON.parse(JSON.stringify({ type: 'meal-log-backup', formatVersion: 1, dbVersion: 3, exportedAt, app: { name: 'Meal Log' }, data: copied })));
}
export function backupCounts(backup: Backup) { return Object.fromEntries(backupTables.map(table => [table, backup.data[table].length])) as Record<typeof backupTables[number], number>; }
export function backupFilename(date: Date) { return `meal-log-backup-${localDate(date)}-${localTime(date).replace(':', '')}.json`; }
