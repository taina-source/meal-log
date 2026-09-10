import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { chatgptModified, chatgptSourceLabel, chatgptTotals, chatgptWarnings, consumeImportFragment, fragmentLimit, normalizeChatgptItem, parseChatgptJson, readChatgptJson, safeSourceUrl, type ChatgptItem } from '../domain/chatgpt';
import { registerChatgpt } from './chatgpt';
import { db, MealLogDatabase } from './db';
import { copyPreviousDay } from './copyMeals';
import { getDayMeals, saveMeal } from './repository';
import { sumNutrients } from '../domain/nutrition';

const item: ChatgptItem = { name: 'テスト食事', restaurant: '試験店', calories: 600, protein: 30, fat: 20, carbs: 75, quantity: 1, unit: '個', sourceType: 'official', sourceUrl: 'https://example.com/nutrition', sourceTitle: 'テスト出典', confidence: 'high', notes: '試験専用データ' };
const json = (items: unknown[] = [item]) => JSON.stringify({ schemaVersion: 1, type: 'meal-log-chatgpt', items });
const context = { date: '2026-09-10', time: '12:30', mealType: 'lunch' as const };
const receipt = () => readChatgptJson(json());
beforeEach(async () => { await db.meals.clear(); });

it('schemaVersion1を読み込む', () => expect(parseChatgptJson(json()).items).toEqual([item]));
it('旧単品形式を数量1・個へ正規化する', () => { const { quantity: _q, unit: _u, ...legacy } = item; expect(parseChatgptJson(JSON.stringify(legacy))).toEqual(parseChatgptJson(json())); });
it('複数品を順番どおり保持する', () => expect(parseChatgptJson(json([item, { ...item, name: '2品目' }])).items.map(i => i.name)).toEqual([item.name, '2品目']));
it.each([
  ['type違い', { schemaVersion: 1, type: 'other', items: [item] }],
  ['未知版', { schemaVersion: 2, type: 'meal-log-chatgpt', items: [item] }],
  ['空items', { schemaVersion: 1, type: 'meal-log-chatgpt', items: [] }],
  ['21件', { schemaVersion: 1, type: 'meal-log-chatgpt', items: Array(21).fill(item) }],
  ['配列ルート', [item]], ['nullルート', null], ['部分envelope', { ...item, schemaVersion: 1 }],
])('%sは拒否する', (_name, value) => expect(() => parseChatgptJson(JSON.stringify(value))).toThrow());
it.each([
  ['負calories', { calories: -1 }], ['負P', { protein: -1 }], ['数値文字列', { fat: '20' }], ['NaN文字列', { carbs: 'NaN' }], ['boolean', { calories: true }],
  ['数量0', { quantity: 0 }], ['負数量', { quantity: -1 }], ['null数量', { quantity: null }], ['空商品名', { name: ' ' }], ['長い名前', { name: 'x'.repeat(101) }],
  ['巨大notes', { notes: 'x'.repeat(2001) }], ['不明source', { sourceType: 'database' }], ['不明confidence', { confidence: 'unknown' }], ['配列confidence', { confidence: ['high'] }],
])('%sを不正として拒否する', (_name, patch) => expect(() => parseChatgptJson(json([{ ...item, ...patch }]))).toThrow());
it.each([NaN, Infinity, -Infinity])('非有限の数値%sを拒否する', value => expect(() => normalizeChatgptItem({ ...item, calories: value })).toThrow());
it('JSON指数によるInfinityも拒否する', () => expect(() => parseChatgptJson(json().replace('600', '1e999'))).toThrow());
it('nullと欠落栄養は不明のまま確認可能・登録不可', () => { const parsed = parseChatgptJson(json([{ ...item, protein: null, fat: undefined }])); expect(parsed.items[0].protein).toBeNull(); expect(parsed.items[0].fat).toBeNull(); expect(() => chatgptTotals(parsed.items)).toThrow('入力'); });
it('128KiBより大きな貼り付けを拒否する', () => expect(() => parseChatgptJson(' '.repeat(131073))).toThrow('長すぎ')); 
it('不正JSONを例外のままUIに漏らさない', () => expect(readChatgptJson('```oops').error).toContain('読み込めませんでした'));
it('20件まで受理する', () => expect(parseChatgptJson(json(Array(20).fill(item))).items).toHaveLength(20));

function target(hash: string) { return { location: { hash, pathname: '/meal-log/', search: '' } as Location, history: { state: { retained: true }, replaceState: vi.fn() } as unknown as History }; }
it('fragmentを1回だけdecodeし、先に削除する', () => { const t = target('#ml-import=' + encodeURIComponent(json([{ ...item, name: 'A+B & 50% #テスト' }]))); expect(consumeImportFragment(t)?.payload?.items[0].name).toBe('A+B & 50% #テスト'); expect(t.history.replaceState).toHaveBeenCalledWith({ retained: true }, '', '/meal-log/'); });
it.each(['#ml-import=%E0%A4%A', '#ml-import=oops', '#ml-import=' + 'x'.repeat(fragmentLimit)])('不正・過大fragmentでも削除する', hash => { const t = target(hash); expect(consumeImportFragment(t)?.error).toBeTruthy(); expect(t.history.replaceState).toHaveBeenCalledTimes(1); });
it('関係ないhashを変更しない', () => { const t = target('#other'); expect(consumeImportFragment(t)).toBeNull(); expect(t.history.replaceState).not.toHaveBeenCalled(); });
it('二重エンコードを黙って受理しない', () => expect(consumeImportFragment(target('#ml-import=' + encodeURIComponent(encodeURIComponent(json()))))?.error).toBeTruthy());
it('history失敗でもアプリを落とさず取り込み拒否', () => { const t = target('#ml-import=' + encodeURIComponent(json())); vi.mocked(t.history.replaceState).mockImplementation(() => { throw new Error('denied'); }); expect(consumeImportFragment(t)?.payload).toBeUndefined(); });
it.each(['javascript:alert(1)', 'http://example.com', 'data:text/html,a', 'https://u:p@example.com', 'not a URL'])('危険なURL %sをリンクにしない', url => expect(safeSourceUrl(url)).toBeNull());
it('official＋URLと推定を明確に区別', () => { expect(chatgptSourceLabel(item)).toBe('ChatGPT経由・公式情報'); expect(chatgptSourceLabel({ ...item, sourceUrl: '' })).toContain('出典URLなし'); expect(chatgptSourceLabel({ ...item, sourceType: 'estimate' })).toBe('ChatGPT推定'); });
it('大きな値と4/9/4不一致は警告のみ', () => { const large = { ...item, calories: 25000 }; expect(chatgptWarnings(large)).toHaveLength(2); expect(chatgptTotals([large]).calories).toBe(25000); });
it('不明URLは警告・公式DBへ昇格しない', () => expect(chatgptWarnings({ ...item, sourceUrl: '' })[0]).toContain('出典URL'));
it('数量×各栄養素・複数品合計', () => expect(chatgptTotals([item, { ...item, quantity: 2 }])).toEqual({ calories: 1800, protein: 90, fat: 60, carbs: 225 }));
it('乗算・加算overflowは拒否する', () => expect(() => chatgptTotals([{ ...item, quantity: 1e308 }])).toThrow('計算'));
it('すべての編集フィールドを検出する', () => { for (const key of ['name', 'restaurant', 'unit'] as const) expect(chatgptModified(item, { ...item, [key]: '変更' })).toBe(true); for (const key of ['quantity', 'calories', 'protein', 'fat', 'carbs'] as const) expect(chatgptModified(item, { ...item, [key]: 99 })).toBe(true); expect(chatgptModified(item, { ...item })).toBe(false); });

it('ChatGPT専用sourceと元値を数量倍せずsnapshot保存する', async () => { const [entry] = await registerChatgpt(receipt(), [{ ...item, quantity: 2, calories: 650, restaurant: '修正店', unit: '皿' }], context); expect(entry).toMatchObject({ sourceType: 'chatgpt', confidence: null, calories: 1300, restaurant: '修正店', chatgptUnit: '皿', chatgptUserModified: true, quantity: 2 }); expect(entry.restaurantSnapshot).toBeUndefined(); const { sourceType: _s, ...originalSnapshot } = item; expect(entry.chatgptSnapshot).toMatchObject({ ...originalSnapshot, declaredSourceType: 'official', schemaVersion: 1, calories: 600, quantity: 1 }); });
it('複数MealEntry・同一importId・Home合計・History読み出し', async () => { const r = readChatgptJson(json([item, { ...item, name: '2品目' }])); const entries = await registerChatgpt(r, r.payload!.items, context); expect(entries).toHaveLength(2); expect(entries[0].chatgptImportId).toBe(entries[1].chatgptImportId); expect(entries[0].id).not.toBe(entries[1].id); expect(sumNutrients(await getDayMeals(context.date)).calories).toBe(1200); expect(await db.meals.orderBy('eatenAt').toArray()).toHaveLength(2); });
it('欠落・負値は一括保存を開始しない', async () => { const r = readChatgptJson(json([item, { ...item, protein: null }])); await expect(registerChatgpt(r, r.payload!.items, context)).rejects.toThrow(); expect(await db.meals.count()).toBe(0); });
it('nullの補完は元nullを保持して保存', async () => { const r = readChatgptJson(json([{ ...item, protein: null }])); const [entry] = await registerChatgpt(r, [item], context); expect(entry.chatgptUserModified).toBe(true); expect(entry.chatgptSnapshot?.protein).toBeNull(); });
it('日時不正は保存しない', async () => { await expect(registerChatgpt(receipt(), [item], { ...context, date: '2026-02-30' })).rejects.toThrow(); expect(await db.meals.count()).toBe(0); });
it('後の元オブジェクト変更と履歴編集でsnapshotを失わない', async () => { const r = receipt(), [entry] = await registerChatgpt(r, r.payload!.items, context); r.payload!.items[0].protein = 999; const edited = await saveMeal({ ...entry, calories: 25000 }, entry.id); expect(edited.sourceType).toBe('chatgpt'); expect(edited.chatgptUserModified).toBe(true); expect(edited.chatgptSnapshot?.protein).toBe(30); expect(edited.calories).toBe(25000); });
it('前日コピーはsnapshot維持・group更新・二重防止', async () => { const r = readChatgptJson(json([item, item])); const entries = await registerChatgpt(r, r.payload!.items, context); expect(await copyPreviousDay('2026-09-11', ['lunch'])).toEqual({ copied: 2, skipped: 0 }); const copies = await getDayMeals('2026-09-11'); expect(copies[0].chatgptSnapshot).toEqual(entries[0].chatgptSnapshot); expect(copies[0].chatgptImportId).not.toBe(entries[0].chatgptImportId); expect(copies[0].chatgptImportId).toBe(copies[1].chatgptImportId); expect(await copyPreviousDay('2026-09-11', ['lunch'])).toEqual({ copied: 0, skipped: 2 }); });
it('別接続で再読込・v3を維持', async () => { const [entry] = await registerChatgpt(receipt(), [item], context); const connection = new MealLogDatabase(); try { expect(await connection.meals.get(entry.id)).toEqual(entry); expect(connection.verno).toBe(3); } finally { connection.close(); } });
