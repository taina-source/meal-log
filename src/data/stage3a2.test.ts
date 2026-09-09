import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { newDatasets, newMenus } from '../testing/stage3a2';
import { restaurants } from './restaurants';
import { cartTotal, changeCart, completeNutrients, isComplete, menuGroups, menuSourceType, nutrientKeys, recentRestaurants, searchMenus, searchRestaurants } from '../domain/restaurantMenus';
import { registerRestaurantOrder } from './restaurantRepository';
import { db, MealLogDatabase } from './db';
import { saveFavorite, removeFavorite, saveRecipe, saveSet } from './catalogRepository';
import { saveMeal, saveSettings, saveWeight } from './repository';
import { sampleRecipe, rice } from '../testing/fixtures';
import { foodItem } from '../domain/foods';
import { defaultSettings } from '../domain/types';
import { copyPreviousDay } from './copyMeals';
const context = { date: '2026-09-08', time: '12:00', mealType: 'lunch' as const };
const find = (chain: string, name: string, size?: string) => {
  const item = newMenus.find(i => i.restaurantId === `restaurant:${chain}` && i.name === name && (!size || i.size === size));
  if (!item) throw new Error(`fixture missing: ${chain}/${name}/${size}`);
  return item;
};
const bowl = find('なか卯', '親子丼', '並盛');
const legacyRaw = import.meta.glob<string>('../../public/data/restaurants/{mcdonalds,kfc,mos,sukiya,yoshinoya,matsuya,marugame}.json', { query: '?raw', import: 'default', eager: true });
beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())); });
describe('第3A-2 静的データ品質', () => {
  it.each(newDatasets.map((d,i) => [d.metadata.restaurantId, d, [150,340,440,180,970,2900,360][i]] as const))('%s JSON・最低件数・provenance・unknown', (_,d,min) => {
    expect(d.items.length).toBeGreaterThanOrEqual(min);
    expect(d.items).toHaveLength(d.metadata.variantCount);
    expect(new Set(d.items.map(i=>i.id)).size).toBe(d.items.length);
    expect(new Set(d.items.map(i=>`${i.productGroupId}:${i.variantName.normalize('NFKC')}`)).size).toBe(d.items.length);
    for(const item of d.items) {
      expect(item.name.trim()).not.toBe(''); expect(restaurants.some(r=>r.id===item.restaurantId)).toBe(true);
      for(const key of nutrientKeys) {
        const p=item.nutrientProvenance[key]; expect(p.value).toBe(item[key]); expect(p.retrievedAt).toBe('2026-09-08'); expect(p.sourceUrl).toMatch(/^https:\/\//); expect(p.sourceTitle).not.toBe('');
        expect(['official','official_old','secondary','estimate','unknown']).toContain(p.sourceType);
        if(item[key]===null) {expect(p.sourceType).toBe('unknown'); expect(item.rawNutrients[key]).not.toMatch(/^0(?:\.0)*$/); expect(isComplete(item)).toBe(false);}
        else {expect(Number.isFinite(item[key])).toBe(true);expect(item[key]).toBeGreaterThanOrEqual(0);}
      }
    }
  });
  it('14チェーンのみ実データを同梱し残る7店は維持', () => { expect(newDatasets).toHaveLength(7); expect(restaurants).toHaveLength(21); expect(new Set(newMenus.map(i=>i.restaurantId)).size).toBe(7); expect(newMenus.some(i=>i.restaurantId==='restaurant:ガスト')).toBe(false); });
  it.each([
    ['kfc','eebcf11f560f26471971c0a0efab98a443f295b34a437a04b4eb7fd348c7d7dd'],
    ['marugame','f4d93026c259837fc766ebc165145051deeb9353124b8374be8e141c3d60d02c'],
    ['matsuya','3d743625cc6ca75f394b7f63bda0aaf4890ac8bf3a06559f72c5f981f7cdb9ce'],
    ['mcdonalds','462631d0164cba386d6fdb24dc16a1e972f8b801ed2d13067998d37b96bcf536'],
    ['mos','b3c942e3fa626ffd90b66ec94c77eda7041c367d98f2509b5c3f41f1ef44d5bd'],
    ['sukiya','f267996f00446c5ee7fdcc030c462df635b77815a7dc7e060f9f758861b33b2b'],
    ['yoshinoya','88ecc5ed4a9a5c32c0e33141ceaf026fdc149fbE0e36c6e81485604d425f0187'],
  ])('既存%s JSONがバイト単位で不変', async (name,hash) => { const bytes=new TextEncoder().encode(legacyRaw[`../../public/data/restaurants/${name}.json`]); const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''); expect(actual).toBe(hash.toLowerCase()); });
  it('店名・別名・全半角・かなでSUBWAYを検索', () => { expect(searchRestaurants(restaurants,'さぶうぇい')[0].name).toBe('SUBWAY'); expect(searchMenus(newMenus,restaurants,'ｓｕｂｗａｙ')).toHaveLength(newDatasets[0].items.length); expect(searchMenus(newMenus,restaurants,'サブウェイ えび')).toEqual(searchMenus(newMenus,restaurants,'さぶうぇい エビ')); });
  it('複数チェーンをハンバーグで横断検索', () => expect(new Set(searchMenus(newMenus,restaurants,'ハンバーグ').map(i=>i.restaurantId)).size).toBeGreaterThanOrEqual(3));
  it('SUBWAYの標準完成品・サラダ・部品を混同しない', () => { const items=searchMenus(newMenus,restaurants,'SUBWAY たまご'); expect(new Set(items.map(i=>i.category)).size).toBeGreaterThan(1); expect(find('SUBWAY','えびアボカド','レギュラー・おすすめ構成').notes.join()).toContain('おすすめ構成'); });
  it('なか卯の公式小盛・並盛・大盛を選択', () => { const group=menuGroups(newMenus).find(g=>g[0].productGroupId===bowl.productGroupId)!; expect(group.map(i=>i.size)).toEqual(['小盛','並盛','大盛']);expect(completeNutrients(bowl)).toEqual({calories:673,protein:30,fat:16.5,carbs:99.7}); });
  it('はなまるうどん本体＋天ぷらを公式値で合算', () => { const udon=find('はなまるうどん','かけ','中'),tempura=find('はなまるうどん','大海老天※'); expect(cartTotal([{item:udon,quantity:1},{item:tempura,quantity:2}]).calories).toBe(897); expect(new Set(newMenus.filter(i=>i.productGroupId===udon.productGroupId).map(i=>i.size))).toEqual(new Set(['小','中','大'])); });
  it('はなまるPDFの境界セルを原文で回収する', () => { const item=find('はなまるうどん','玉とろぶっかけ','大');expect(completeNutrients(item)).toEqual({calories:1088,protein:30.1,fat:13.1,carbs:212.1}); });
  it('CoCo公式300gカレー＋公式チーズ単品のみを加算', () => { const curry=find('CoCo壱番屋','ポークカレー','ライス300g'),cheese=find('CoCo壱番屋','チーズ'); expect(cartTotal([{item:curry,quantity:1},{item:cheese,quantity:1}])).toEqual({calories:896,protein:23.9,fat:34.1,carbs:128.3}); expect(newMenus.filter(i=>i.productGroupId===curry.productGroupId)).toHaveLength(1); });
  it('CoCoの公式ライス100g/200g別メニューを保持', () => { const rows=newMenus.filter(i=>i.name==='特定原材料を使用していないカレー');expect(rows.map(i=>i.size)).toEqual(['ライス200g','ライス100g']);expect(rows.map(i=>i.calories)).toEqual([492,246]); });
  it('CoCoパッケージ参照をnullとし疑義のある公式値を登録不可', () => { expect(isComplete(find('CoCo壱番屋','リンゴドリンク'))).toBe(false);const item=find('CoCo壱番屋','お子さまカレー ソーセージ');expect(item.calories).toBe(417);expect(item.registrationBlockedReason).toContain('整合性');expect(()=>changeCart([],item,1)).toThrow(); });
  it('大戸屋の糖質・食物繊維をCと混同せずnullと店舗を保持', () => { const item=find('大戸屋','塩麹豚と白菜漬けの豚しんこ');expect(item.carbs).toBeNull();expect(isComplete(item)).toBe(false);expect(item.rawNutrients.carbs).toBe('炭水化物の直接掲載なし（糖質 84.3g・食物繊維 3.5g）');expect(item.region).toBe('丸の内新東京ビル店');expect(item.nutrientProvenance.carbs.notes.join()).toContain('null'); });
  it('ロイヤルホストは地域・未測定・現在リンクの旧更新日を保持', () => { const items=newDatasets[5].items;expect(new Set(items.map(i=>i.region)).size).toBe(10);expect(items.some(i=>i.protein===null)).toBe(true);expect(items.some(i=>i.nutrientProvenance.protein.publishedOrUpdatedAt==='2026-06-24' && i.nutrientProvenance.protein.sourceType==='official')).toBe(true); });
  it('びっくりドンキーの公式S/M/Lとディッシュ・ステーキを分離', () => { const dish=find('びっくりドンキー','レギュラーハンバーグディッシュ','S');const g=menuGroups(newMenus).find(g=>g[0].productGroupId===dish.productGroupId)!;expect(g.map(i=>i.size)).toEqual(['S','M','L']);expect(g.map(i=>i.calories)).toEqual([723,814,996]);expect(find('びっくりドンキー','レギュラーバーグステーキ','S').productGroupId).not.toBe(dish.productGroupId); });
});
describe('新チェーン保存と互換性',()=>{
  it.each(newDatasets.map(d=>[d.metadata.restaurantId,d.items.find(isComplete) ?? d.items[0]] as const))('%s を共通カートから登録し再接続',async(_,item)=>{if(!isComplete(item)){await expect(registerRestaurantOrder([{item,quantity:1}],context)).rejects.toThrow();expect(await db.meals.count()).toBe(0);return;}const [entry]=await registerRestaurantOrder([{item,quantity:2}],context);expect(entry.calories).toBe(item.calories!*2);expect(entry.restaurantSnapshot).toEqual(item);db.close();await db.open();expect(await db.meals.get(entry.id)).toEqual(entry);});
  it('数量変更・削除・複数店の注文ID・合計',async()=>{let cart=changeCart([],bowl,1);cart=changeCart(cart,find('CoCo壱番屋','チーズ'),2);cart=changeCart(cart,bowl,2);expect(cartTotal(cart).calories).toBe(1736);const saved=await registerRestaurantOrder(cart,context);expect(new Set(saved.map(m=>m.restaurantOrderId)).size).toBe(1);expect(changeCart(cart,bowl,0)).toHaveLength(1);});
  it.each(['official_old','secondary','estimate'] as const)('混在する%sを代表値とし内訳もスナップショット保存',async kind=>{const item=structuredClone(bowl);item.nutrientProvenance.protein.sourceType=kind;expect(menuSourceType(item)).toBe(kind);const [saved]=await registerRestaurantOrder([{item,quantity:1}],context);expect(saved.sourceType).toBe(kind);expect(saved.nutrientProvenance?.calories.sourceType).toBe('official');expect(saved.nutrientProvenance?.protein.sourceType).toBe(kind);});
  it('不明商品の注文は全件を保存しない',async()=>{const unknown=newMenus.find(i=>i.protein===null)!;await expect(registerRestaurantOrder([{item:bowl,quantity:1},{item:unknown,quantity:1}],context)).rejects.toThrow();expect(await db.meals.count()).toBe(0);});
  it('お気に入り店舗・商品・最近の店は再起動後も保持',async()=>{const a=await saveFavorite('restaurant',bowl.restaurantId,1);await saveFavorite('restaurantMenu',bowl.id,1);await registerRestaurantOrder([{item:bowl,quantity:2}],context);db.close();await db.open();expect(await db.favorites.count()).toBe(2);expect(recentRestaurants(await db.meals.toArray())[0].count).toBe(1);await removeFavorite(a.id);expect(await db.favorites.count()).toBe(1);});
  it('後日データ変更と前日コピーでも過去値は不変',async()=>{const item=structuredClone(bowl);const [saved]=await registerRestaurantOrder([{item,quantity:1}],context);item.name='変更';item.calories=999;item.nutrientProvenance.protein.value=1;expect(await db.meals.get(saved.id)).toEqual(saved);await copyPreviousDay('2026-09-09',['lunch']);expect((await db.meals.toArray()).find(m=>m.copiedFromId)?.restaurantSnapshot).toEqual(bowl);expect(await copyPreviousDay('2026-09-09',['lunch'])).toEqual({copied:0,skipped:1});});
  it('既存v3全6テーブルと外食履歴を完全一致で再読込',async()=>{await saveMeal({name:'手入力',calories:100,protein:1,fat:2,carbs:3,mealType:'breakfast',eatenAt:'2026-09-08T00:00:00Z'});await saveWeight(context.date,102.8);await saveSettings(defaultSettings);await saveRecipe(sampleRecipe());await saveSet('既存セット',[foodItem(rice,200,'rice')]);await saveFavorite('food',rice.id,200);await registerRestaurantOrder([{item:bowl,quantity:1}],context);const snapshots=await Promise.all(db.tables.map(async t=>({name:t.name,rows:await t.toArray()})));db.close();const reopened=new MealLogDatabase();try {await reopened.open();expect(reopened.verno).toBe(3);for(const s of snapshots)expect(await reopened.table(s.name).toArray()).toEqual(s.rows);}finally{reopened.close();await db.open();}});
});
