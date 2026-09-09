import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mcd from '../../public/data/restaurants/mcdonalds.json';
import kfc from '../../public/data/restaurants/kfc.json';
import mos from '../../public/data/restaurants/mos.json';
import sukiya from '../../public/data/restaurants/sukiya.json';
import yoshinoya from '../../public/data/restaurants/yoshinoya.json';
import matsuya from '../../public/data/restaurants/matsuya.json';
import marugame from '../../public/data/restaurants/marugame.json';
import type { RestaurantMenuItem } from '../domain/catalog';
import { cartTotal, changeCart, completeNutrients, isComplete, menuGroups, menuSourceType, nutrientKeys, recentRestaurants, searchMenus, searchRestaurants } from '../domain/restaurantMenus';
import { restaurants } from './restaurants';
import { db, MealLogDatabase } from './db';
import { registerRestaurantOrder } from './restaurantRepository';
import { loadRestaurantMenus, restaurantFiles } from './restaurantMenus';
import { saveFavorite, removeFavorite, saveRecipe, saveSet } from './catalogRepository';
import { copyPreviousDay } from './copyMeals';
import { saveMeal, saveSettings, saveWeight } from './repository';
import { defaultSettings } from '../domain/types';
import { foodItem } from '../domain/foods';
import { rice, sampleRecipe } from '../testing/fixtures';
import { newDatasets } from '../testing/stage3a2';
const datasets = [mcd, kfc, mos, sukiya, yoshinoya, matsuya, marugame];
const items = datasets.flatMap(d => d.items as RestaurantMenuItem[]);
const burger = items.find(i => i.restaurantId === 'restaurant:KFC' && i.name === 'ダブルチキンフィレバーガー')!;
const potato = items.find(i => i.restaurantId === 'restaurant:KFC' && i.name.includes('ポテト') && i.size.normalize('NFKC') === 'S')!;
const context = { date: '2026-09-08', time: '12:00', mealType: 'lunch' as const };
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

describe('公式外食データ品質', () => {
  it.each(datasets.map((d,i) => [restaurantFiles[i], d] as const))('%s の件数・列・ID・variant・出典を検証', (_, dataset) => {
    const rows = dataset.items as RestaurantMenuItem[];
    expect(rows).toHaveLength(dataset.metadata.variantCount);
    expect(rows.length).toBeGreaterThan(50);
    expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
    expect(new Set(rows.map(r => r.productGroupId + ':' + r.variantName)).size).toBe(rows.length);
    for (const row of rows) {
      expect(restaurants.some(r => r.id === row.restaurantId)).toBe(true); expect(row.name.trim()).not.toBe('');
      for (const key of nutrientKeys) {
        const p = row.nutrientProvenance[key];
        expect(p.value).toBe(row[key]); expect(p.sourceUrl).toMatch(/^https:\/\//); expect(p.sourceTitle.length).toBeGreaterThan(0); expect(p.retrievedAt).toBe('2026-09-08');
        if (row[key] === null) { expect(p.sourceType).toBe('unknown'); expect(row.rawNutrients[key]).not.toMatch(/^0(?:\.0)?$/); }
        else { expect(Number.isFinite(row[key])).toBe(true); expect(row[key]).toBeGreaterThanOrEqual(0); expect(p.sourceType).toBe('official'); }
      }
    }
  });
  it('既存7JSONを含む全14ファイルをbase配下から読み込む', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const name = String(input).split('/').pop()?.replace('.json', '');
      const index = restaurantFiles.indexOf(name as typeof restaurantFiles[number]);
      expect(String(input)).toMatch(/\/meal-log\/data\/restaurants\//);
      return new Response(JSON.stringify([...datasets, ...newDatasets][index]), { status: 200 });
    });
    try { expect(await loadRestaurantMenus()).toHaveLength(1979 + newDatasets.reduce((n,d) => n + d.items.length,0)); expect(fetch).toHaveBeenCalledTimes(14); } finally { fetch.mockRestore(); }
  });
  it('21チェーンを維持し第3A-1の7チェーン件数が不変', () => { expect(restaurants).toHaveLength(21); expect(new Set(items.map(i => i.restaurantId)).size).toBe(7); expect(menuGroups(items)).toHaveLength(1116); expect(items.some(i => i.restaurantId === 'restaurant:吉野家' && i.name.includes('大判豚肩'))).toBe(false); expect(items.find(i => i.restaurantId === 'restaurant:すき家' && i.name === '牛丼')?.category).toBe('牛丼'); });
  it('公式KFC実値を使い説明例の架空値を使わない', () => expect(completeNutrients(burger)).toEqual({ calories: 615, protein: 44.6, fat: 30.7, carbs: 40 }));
  it('チェーン名と別名を検索できる', () => { expect(searchRestaurants(restaurants, 'けんたっきー')[0].name).toBe('KFC'); expect(searchRestaurants(restaurants, 'マック')[0].name).toBe('マクドナルド'); });
  it('全チェーンの商品・店名・サイズを横断検索する', () => { expect(searchMenus(items, restaurants, 'ダブルチキン')).toContain(burger); expect(searchMenus(items, restaurants, 'ポテト').some(i => i.restaurantId === 'restaurant:マクドナルド')).toBe(true); expect(searchMenus(items, restaurants, 'KFC ポテト S')).toContain(potato); });
  it('表記揺れとaliasesを検索する', () => { expect(searchMenus(items, restaurants, 'ｋｆｃ')).toEqual(searchMenus(items, restaurants, 'KFC')); expect(searchMenus(items, restaurants, 'ぽてと')).toEqual(searchMenus(items, restaurants, 'ポテト')); expect(searchMenus([{ ...burger, aliases: ['二枚チキン'] }], restaurants, '二枚チキン')).toHaveLength(1); });
  it('同名のサイズ・McCaféの異なる値を分離する', () => { const groups = menuGroups(items.filter(i => i.restaurantId === 'restaurant:マクドナルド')); const fries = groups.find(g => g[0].name.startsWith('マックフライポテト'))!; expect(fries).toHaveLength(3); const latte = items.filter(i => i.name === 'アイスカフェラテ' && ['M','Ｍ'].includes(i.size)); expect(new Set(latte.map(i => i.calories)).size).toBeGreaterThan(1); });
  it('PFC不明2件を0にせず登録対象から外す', () => { const partial = items.filter(i => nutrientKeys.some(k => i[k] === null)); expect(partial).toHaveLength(2); partial.forEach(i => { expect(isComplete(i)).toBe(false); expect(() => completeNutrients(i)).toThrow(); }); });
  it('公式表の量が曖昧な商品も登録不可', () => { const item = items.find(i => i.registrationBlockedReason)!; expect(item.name).toBe('コカ・コーラ'); expect(isComplete(item)).toBe(false); expect(() => completeNutrients(item)).toThrow('量'); });
  it('数量変更と削除・複数商品の合計を計算', () => { let cart = changeCart([], burger, 1); cart = changeCart(cart, potato, 2); expect(cartTotal(cart).calories).toBe(1005); cart = changeCart(cart, burger, 2); expect(cartTotal(cart).protein).toBeCloseTo(94.4); expect(changeCart(cart, potato, 0)).toHaveLength(1); });
  it.each([-1, .5, 100, NaN, Infinity])('不正数量%sを拒否する', quantity => expect(() => changeCart([], burger, quantity)).toThrow());
  it('栄養素単位の過去公式・推定を識別する', () => { const item = structuredClone(burger); item.nutrientProvenance.protein.sourceType = 'official_old'; expect(menuSourceType(item)).toBe('official_old'); item.nutrientProvenance.fat.sourceType = 'estimate'; expect(menuSourceType(item)).toBe('estimate'); item.nutrientProvenance.fat.sourceType = 'secondary'; expect(menuSourceType(item)).toBe('secondary'); });
});

describe('外食の保存・互換性', () => {
  it('商品別MealEntry・同じorderId・数量・provenanceを保存', async () => { const saved = await registerRestaurantOrder([{ item: burger, quantity: 2 }, { item: potato, quantity: 1 }], context); expect(saved).toHaveLength(2); expect(saved[0].calories).toBe(1230); expect(saved[0].restaurantOrderId).toBe(saved[1].restaurantOrderId); expect(saved[0].restaurantId).toBe('restaurant:KFC'); expect(saved[0].nutrientProvenance).toEqual(burger.nutrientProvenance); expect(await db.meals.count()).toBe(2); });
  it('公式値更新後も名前・サイズ・出典・栄養スナップショット保持', async () => { const item = structuredClone(burger); const [saved] = await registerRestaurantOrder([{ item, quantity: 1 }], context); item.calories = 999; item.name = '更新後'; item.nutrientProvenance.protein.value = 999; expect(await db.meals.get(saved.id)).toEqual(saved); expect(saved.restaurantSnapshot?.name).toBe(burger.name); });
  it('店舗・商品お気に入りの保存・重複防止・削除', async () => { const a = await saveFavorite('restaurant', burger.restaurantId, 1); const b = await saveFavorite('restaurantMenu', burger.id, 1); await saveFavorite('restaurantMenu', burger.id, 1); expect(await db.favorites.count()).toBe(2); await removeFavorite(a.id); await removeFavorite(b.id); expect(await db.favorites.count()).toBe(0); });
  it('最近使った店は商品数で水増しせず注文回数と日時から導出', async () => { await registerRestaurantOrder([{ item: burger, quantity: 1 }, { item: potato, quantity: 1 }], context); await registerRestaurantOrder([{ item: burger, quantity: 1 }], context); const recent = recentRestaurants(await db.meals.toArray()); expect(recent[0].id).toBe(burger.restaurantId); expect(recent[0].count).toBe(2); });
  it('部分不明が混じる注文は一部も保存しない', async () => { const partial = items.find(i => i.protein === null)!; await expect(registerRestaurantOrder([{ item: burger, quantity: 1 }, { item: partial, quantity: 1 }], context)).rejects.toThrow(); expect(await db.meals.count()).toBe(0); });
  it('手動編集した栄養を公式値と表示しない・元出典は保持', async () => { const [saved] = await registerRestaurantOrder([{ item: burger, quantity: 1 }], context); const edited = await saveMeal({ ...saved, calories: 800 }, saved.id); expect(edited.sourceType).toBe('manual'); expect(edited.manuallyEditedNutrition).toBe(true); expect(edited.nutrientProvenance).toBeUndefined(); expect(edited.restaurantSnapshot).toEqual(burger); });
  it('前日コピーは栄養・出典を保ち注文IDを更新して二重コピーを防ぐ', async () => { const entries = await registerRestaurantOrder([{ item: burger, quantity: 1 }, { item: potato, quantity: 1 }], context); expect(await copyPreviousDay('2026-09-09', ['lunch'])).toEqual({ copied: 2, skipped: 0 }); expect(await copyPreviousDay('2026-09-09', ['lunch'])).toEqual({ copied: 0, skipped: 2 }); const copies = (await db.meals.toArray()).filter(m => m.copiedFromId); expect(copies[0].restaurantOrderId).not.toBe(entries[0].restaurantOrderId); expect(copies[0].restaurantOrderId).toBe(copies[1].restaurantOrderId); expect(copies[0].restaurantSnapshot).toBeDefined(); });
  it('接続終了・再起動後も外食とお気に入りを保持', async () => { const [saved] = await registerRestaurantOrder([{ item: burger, quantity: 1 }], context); await saveFavorite('restaurant', burger.restaurantId, 1); db.close(); await db.open(); expect(await db.meals.get(saved.id)).toEqual(saved); expect(await db.favorites.count()).toBe(1); });
  it('v2の全6テーブルをv3に完全一致で移行し再接続', async () => {
    await saveMeal({ name: '既存', calories: 420, protein: 20, fat: 10, carbs: 50, mealType: 'breakfast', eatenAt: '2026-09-08T00:00:00Z' }); await saveWeight(context.date, 102.8); await saveSettings(defaultSettings); await saveRecipe(sampleRecipe()); await saveFavorite('food', rice.id, 200); await saveSet('既存セット', [foodItem(rice, 200, 'set-food')]);
    const legacy = new Dexie(`legacy-v2-${crypto.randomUUID()}`);
    legacy.version(2).stores({ meals: 'id, eatenAt, mealType, sourceType, sourceId, setId, [copiedFromId+copyTargetDate]', weights: 'id, &date', settings: 'id', recipes: 'id, name, updatedAt', favorites: 'id, kind, sourceId', mealSets: 'id, name, updatedAt' });
    const snapshots = await Promise.all(db.tables.map(async table => ({ name: table.name, rows: await table.toArray() })));
    for (const snapshot of snapshots) await legacy.table(snapshot.name).bulkAdd(snapshot.rows);
    legacy.close(); const next = new MealLogDatabase(legacy.name);
    try { await next.open(); expect(next.verno).toBe(3); for (const snapshot of snapshots) expect(await next.table(snapshot.name).toArray()).toEqual(snapshot.rows); next.close(); await next.open(); expect(await next.mealSets.count()).toBe(1); } finally { next.close(); }
  });
});
