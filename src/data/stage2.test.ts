import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, MealLogDatabase } from './db';
import { duplicateRecipe, quickEntry, registerItems, removeFavorite, saveFavorite, saveRecipe, saveSet } from './catalogRepository';
import { copyPreviousDay } from './copyMeals';
import { saveMeal, getDayMeals } from './repository';
import { foodItem, recipeItem } from '../domain/foods';
import { recentItems } from '../domain/recents';
import { defaultSettings, type MealEntry } from '../domain/types';
import { egg, rice, sampleRecipe } from '../testing/fixtures';
const context = { date: '2026-09-06', time: '12:34', mealType: 'lunch' as const };
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
describe('第2段階の保存・スナップショット', () => {
  it('レシピを編集し、複製は別IDで元を保持する', async () => { const recipe = await saveRecipe(sampleRecipe()); const modified = await saveRecipe({ ...recipe, name: '変更後', servings: 4 }, recipe.id); expect(modified.id).toBe(recipe.id); expect(modified.servings).toBe(4); const copy = await duplicateRecipe(modified, '別レシピ'); expect(copy.id).not.toBe(recipe.id); expect(copy.name).toBe('別レシピ'); expect((await db.recipes.get(recipe.id))?.name).toBe('変更後'); });
  it('別画面で変更済みのレシピの上書きを拒否する', async () => { const recipe = await saveRecipe(sampleRecipe()); await expect(saveRecipe(recipe, recipe.id, 'outdated')).rejects.toThrow('別の画面'); });
  it('お気に入りは同じ食品と重量で重複せず、別重量は区別する', async () => { const favorite = await saveFavorite('food', rice.id, 200); await saveFavorite('food', rice.id, 200); await saveFavorite('food', rice.id, 100); expect(await db.favorites.count()).toBe(2); await removeFavorite(favorite.id); expect(await db.favorites.count()).toBe(1); });
  it('レシピとセットもお気に入り保存・解除できる', async () => { const a = await saveFavorite('recipe', 'recipe1', .5); const b = await saveFavorite('set', 'set1', 1); expect(await db.favorites.count()).toBe(2); await removeFavorite(a.id); await removeFavorite(b.id); expect(await db.favorites.count()).toBe(0); });
  it('食品データ変更後も登録済みの食事は変わらない', async () => { const input = foodItem(structuredClone(rice), 200, 'rice'); const [entry] = await registerItems([input], context); input.nutrients.calories = 999; const changed = { ...rice, caloriesPer100g: 999 }; expect(foodItem(changed, 200, 'new').nutrients.calories).toBe(1998); expect((await db.meals.get(entry.id))?.calories).toBe(312); expect((await db.meals.get(entry.id))?.sourceType).toBe('database'); });
  it('レシピ編集後も食事の栄養と材料スナップショットは変わらない', async () => { const recipe = await saveRecipe(sampleRecipe()); const [entry] = await registerItems([recipeItem(recipe,.5,'portion')],context); await saveRecipe({ ...recipe, ingredients: [{ ...recipe.ingredients[0], grams: 1000 }], servings: 1 },recipe.id); const saved = await db.meals.get(entry.id); expect(saved?.calories).toBe(227); expect(saved?.recipeSnapshot?.ingredients).toEqual(recipe.ingredients); expect(saved?.sourceType).toBe('recipe'); });
  it('今回だけ変更した材料は元レシピを変えず食事へ残す', async () => { const recipe = await saveRecipe(sampleRecipe()); const once = { ...recipe, ingredients: [{ ...recipe.ingredients[0], grams: 100 }] }; const [entry] = await registerItems([recipeItem(once,1,'once')],context); expect((await db.recipes.get(recipe.id))?.ingredients).toHaveLength(2); expect((await db.meals.get(entry.id))?.recipeSnapshot?.ingredients).toHaveLength(1); });
  it('セット合計を保存し通常のMealEntry群に一括登録する', async () => { const set = await saveSet('いつもの朝食', [foodItem(rice,200,'1'),foodItem(egg,100,'2')]); expect(set.total.calories).toBe(454); const entries = await registerItems(set.items,context,set); expect(entries).toHaveLength(2); expect(entries[0].setRunId).toBe(entries[1].setRunId); expect(entries[0].setName).toBe('いつもの朝食'); expect(await db.meals.count()).toBe(2); const changed = await saveSet('変更', [foodItem(rice,100,'3')], set.id); expect(changed.total.calories).toBe(156); const recent = recentItems(await db.meals.toArray()).find(item => item.kind === 'set'); expect(recent?.setSnapshot?.total.calories).toBe(454); expect(recent?.setSnapshot?.items.find(item => item.sourceId === rice.id)?.quantity).toBe(200); expect((await db.meals.get(entries[0].id))?.calories).toBe(312); });
  it('セットに不正値がある場合は一部だけ登録しない', async () => { await expect(registerItems([foodItem(rice,100,'1'), { ...foodItem(egg,100,'2'), nutrients: { calories: -1, protein:0,fat:0,carbs:0 } }],context)).rejects.toThrow(); expect(await db.meals.count()).toBe(0); });
  it('かんたん入力の空名・PFC0を保存する', async () => { const meal = await quickEntry(850,' ',context); expect(meal).toMatchObject({ name:'かんたん入力',calories:850,protein:0,fat:0,carbs:0,sourceType:'manual' }); });
  it('かんたん入力の異常値を拒否する', async () => { await expect(quickEntry(-1,'',context)).rejects.toThrow(); await expect(quickEntry(NaN,'',context)).rejects.toThrow(); });
  it('最近使った食品・レシピ・セットを履歴から導出する', async () => {
    // Distinct registration times are part of this test's chronology, not elapsed CPU time.
    // Equal millisecond timestamps otherwise leave the result dependent on random ID order.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-09-06T01:00:00Z'));
      const set = await saveSet('セット', [foodItem(rice,200,'1'),foodItem(egg,100,'2')]);
      await registerItems(set.items,context,set);
      vi.setSystemTime(new Date('2026-09-06T01:00:01Z'));
      await registerItems([foodItem(rice,100,'3')],context);
      vi.setSystemTime(new Date('2026-09-06T01:00:02Z'));
      await registerItems([foodItem(rice,200,'4')],context);
      const recent = recentItems(await db.meals.toArray());
      expect(recent.find(item => item.kind === 'set')?.count).toBe(1);
      expect(recent.find(item => item.kind === 'food')?.count).toBe(2);
      expect(recent.find(item => item.kind === 'food')?.quantity).toBe(200);
    } finally { vi.useRealTimers(); }
  });
  it('再接続後にレシピ・お気に入り・セットと記録が残る', async () => { const recipe = await saveRecipe(sampleRecipe()); await saveFavorite('recipe',recipe.id,.5); await saveSet('セット',[foodItem(rice,100,'1')]); await registerItems([recipeItem(recipe,.5,'2')],context); db.close(); await db.open(); expect(await db.recipes.count()).toBe(1); expect(await db.favorites.count()).toBe(1); expect(await db.mealSets.count()).toBe(1); expect(await db.meals.count()).toBe(1); });
  it('従来の編集でも新しい出典情報を失わない', async () => { const [entry] = await registerItems([foodItem(rice,100,'1')],context); await saveMeal({ ...entry, name:'編集',calories:170 },entry.id); expect(await db.meals.get(entry.id)).toMatchObject({ name:'編集',calories:170,sourceId:rice.id,quantity:100,sourceType:'database' }); });
});
describe('前日の食事コピー', () => {
  it('選択した食事区分を新ID・表示日でコピーし栄養値を保持する', async () => { const [meal] = await registerItems([foodItem(rice,200,'1')],context); await registerItems([foodItem(egg,100,'2')],{...context,mealType:'dinner'}); const result = await copyPreviousDay('2026-09-07',['lunch']); expect(result).toEqual({copied:1,skipped:0}); const [copy] = await getDayMeals('2026-09-07'); expect(copy.id).not.toBe(meal.id); expect(copy.calories).toBe(meal.calories); expect(copy.quantity).toBe(200); expect(copy.copiedFromId).toBe(meal.id); expect(await getDayMeals('2026-09-06')).toHaveLength(2); });
  it('二重実行が重なっても同じ元記録を重複コピーしない', async () => { await registerItems([foodItem(rice,200,'1')],context); const results = await Promise.all([copyPreviousDay('2026-09-07',['lunch']),copyPreviousDay('2026-09-07',['lunch'])]); expect(results.reduce((sum,result)=>sum+result.copied,0)).toBe(1); expect(results.reduce((sum,result)=>sum+result.skipped,0)).toBe(1); expect(await getDayMeals('2026-09-07')).toHaveLength(1); });
  it('コピー対象がない場合は0件', async () => expect(await copyPreviousDay('2026-09-07',['dinner'])).toEqual({copied:0,skipped:0}));
});
describe('v1から現行バージョンへの非破壊移行', () => {
  it('既存の食事・体重・設定を完全一致で保持する', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({ meals:'id, eatenAt, mealType, sourceType',weights:'id, &date',settings:'id' });
    const legacy: MealEntry = {id:'old-meal',name:'旧データ',restaurant:'',calories:620.5,protein:52.2,fat:12,carbs:75,mealType:'lunch',eatenAt:'2026-09-06T03:00:00.000Z',createdAt:'2026-09-06T03:00:00.000Z',updatedAt:'2026-09-06T03:00:00.000Z',sourceType:'manual',confidence:null};
    const weight = {id:'old-weight',date:'2026-09-06',weight:102.8,createdAt:legacy.createdAt};
    const settings = {...defaultSettings,id:'user',theme:'dark',calorieTarget:2300,showPfcDecimals:false};
    await old.table('meals').add(legacy); await old.table('weights').add(weight); await old.table('settings').add(settings); old.close();
    const next = new MealLogDatabase(name);
    try { await next.open(); expect(next.verno).toBe(3); expect(await next.meals.get(legacy.id)).toEqual(legacy); expect(await next.weights.get(weight.id)).toEqual(weight); expect(await next.settings.get('user')).toEqual(settings); expect(await next.recipes.count()).toBe(0); expect(await next.favorites.count()).toBe(0); expect(await next.mealSets.count()).toBe(0); next.close(); await next.open(); expect(await next.meals.get(legacy.id)).toEqual(legacy); } finally { next.close(); }
  });
});
