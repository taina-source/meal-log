import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { stage3a3Datasets, stage3a3Menus as items } from '../testing/stage3a3';
import baseline from '../../data-sources/restaurants/stage3a2-baseline.json';
import type { RestaurantMenuItem } from '../domain/catalog';
import { restaurants } from './restaurants';
import { restaurantFiles } from './restaurantMenus';
import { cartTotal, changeCart, completeNutrients, isComplete, menuGroups, menuSourceType, nutrientKeys, piecesLabel, quantityLabel, recentRestaurants, searchMenus } from '../domain/restaurantMenus';
import { db, MealLogDatabase } from './db';
import { registerRestaurantOrder } from './restaurantRepository';
import { saveFavorite, removeFavorite } from './catalogRepository';
import { copyPreviousDay } from './copyMeals';
const raw = import.meta.glob<string>('../../public/data/restaurants/*.json', { query: '?raw', import: 'default', eager: true });
const context = { date: '2026-09-09', time: '12:00', mealType: 'lunch' as const };
const chainItems = (name: string) => items.filter(i => i.restaurantId === `restaurant:${name}`);
const joy = chainItems('ジョイフル')[0];
const counts = [['ガスト',389],['ジョイフル',345],['天下一品',34],['餃子の王将',266],['スシロー',226],['くら寿司',354],['はま寿司',586]] as const;
beforeEach(async () => { await db.open(); await Promise.all(db.tables.map(t => t.clear())); });

describe('第3A-3 静的データと単位', () => {
  it.each(counts)('%s JSON・件数・ID・variant・栄養素別出典', (chain,count) => {
    const rows=chainItems(chain), data=stage3a3Datasets.find(d=>d.metadata.restaurantId===`restaurant:${chain}`)!;
    expect(rows).toHaveLength(count); expect(data.metadata.variantCount).toBe(count);
    expect(menuGroups(rows)).toHaveLength(data.metadata.productCount);
    expect(new Set(rows.map(i=>i.id)).size).toBe(count);
    expect(new Set(rows.map(i=>`${i.productGroupId}:${i.variantName.normalize('NFKC')}`)).size).toBe(count);
    for(const item of rows) {
      expect(item.name.trim()).not.toBe(''); expect(item.servingBasis).toBeTruthy();
      expect(restaurants.some(s=>s.id===item.restaurantId)).toBe(true);
      for(const key of nutrientKeys) {
        const p=item.nutrientProvenance[key]; expect(p.value).toBe(item[key]);
        expect(p.sourceUrl).toMatch(/^https:\/\//); expect(p.sourceTitle).toBeTruthy(); expect(p.retrievedAt).toBe('2026-09-09');
        expect(['official','official_old','secondary','estimate','unknown']).toContain(p.sourceType);
        if(item[key]===null) {expect(p.sourceType).toBe('unknown'); expect(item.rawNutrients[key]).not.toMatch(/^0(?:\.0)*$/); expect(isComplete(item)).toBe(false);}
        else { expect(Number.isFinite(item[key])).toBe(true); expect(item[key]).toBeGreaterThanOrEqual(0); expect(p.sourceType).toBe('official'); }
      }
    }
  });
  it.each(Object.entries(baseline))('既存 %s JSONのSHA-256が完全一致', async (name, expected) => {
    const text=raw[`../../public/data/restaurants/${name}.json`];
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    expect([...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')).toBe(expected);
  });
  it('21チェーンをすべて読込対象にしメニューが存在する', () => { expect(restaurantFiles).toHaveLength(21); const all=Object.values(raw).flatMap(text=>(JSON.parse(text) as {items:RestaurantMenuItem[]}).items); expect(new Set(all.map(i=>i.restaurantId)).size).toBe(21); });
  it.each([['ガスト','ハンバーグ'],['ジョイフル','ハンバーグ'],['天下一品','こってり'],['餃子の王将','餃子'],['スシロー','まぐろ'],['くら寿司','まぐろ'],['はま寿司','まぐろ']])('%s の実商品検索 %s', (chain,query) => expect(searchMenus(chainItems(chain),restaurants,query).length).toBeGreaterThan(0));
  it('まぐろ横断検索に寿司3店と1皿の提供単位がある', () => { const found=searchMenus(items,restaurants,'まぐろ'); for(const chain of ['スシロー','くら寿司','はま寿司']) expect(found.some(i=>i.restaurantId===`restaurant:${chain}`&&i.servingBasis?.includes('1皿'))).toBe(true); });
  it('全半角・かな検索', () => expect(searchMenus(items,restaurants,'ｼﾞｮｲﾌﾙ はんばーぐ')).toEqual(searchMenus(items,restaurants,'ジョイフル ハンバーグ')));
  it('王将は地域と通常6個・ジャスト3個を区別', () => {const rows=chainItems('餃子の王将').filter(i=>i.name.startsWith('餃子')); expect(rows.some(i=>i.servingBasis==='1人前・6個')).toBe(true);expect(rows.some(i=>i.servingBasis==='1人前・3個')).toBe(true);expect(new Set(rows.map(i=>i.region)).size).toBe(3);});
  it('天下一品は地域別実商品を保持し未検証の過去PFCを使わない', () => { const rows=chainItems('天下一品');expect(new Set(rows.map(i=>i.region)).size).toBe(2);expect(rows.every(i=>nutrientKeys.every(k=>i[k]===null))).toBe(true);});
  it('公式の一貫だけ貫数を保持し、記載なしを2貫にしない', () => { const rows=chainItems('くら寿司');expect(rows.some(i=>i.piecesPerServing===1&&i.servingBasis==='1貫／1皿')).toBe(true);expect(rows.filter(i=>!i.name.match(/[一二三四五六八十\d０-９]貫/)).every(i=>i.piecesPerServing==null)).toBe(true);expect(rows.some(i=>i.servingBasis==='1皿')).toBe(true); });
  it('スシロー100mlと持ち帰りセットを1皿として扱わない', () => { const rows=chainItems('スシロー');const drinks=rows.filter(i=>i.servingBasis?.includes('100ml'));expect(drinks.length).toBe(20);expect(drinks.every(i=>i.quantityUnit!=='皿')).toBe(true);expect(rows.filter(i=>i.category==='お持ち帰りメニュー').every(i=>i.quantityUnit==='セット')).toBe(true); });
  it('はま寿司の原表3行補正・括弧・kcalを保持', () => { for(const [name,kcal] of [['(北海道限定)レアステーキ三種盛り(びんちょう、サーモン、アカイカ)',168],['(北海道以外)サーモン三種(サーモン・大トロサーモン・レアステーキ)',157],['(北海道限定)サーモン三種(サーモン・大トロサーモン・レアステーキ)',164]] as const){const item=chainItems('はま寿司').find(i=>i.name===name)!;expect(item.calories).toBe(kcal);expect(item.notes.some(n=>n.includes('補正行'))).toBe(true);expect(item.name.endsWith('))')).toBe(false);} });
  it('はま寿司の同サイズ抹茶ラテ矛盾値は不明、朝食は別variant', () => {const rows=chainItems('はま寿司');const conflicts=rows.filter(i=>i.nutrientProvenance.calories.notes.some(n=>n.includes('熱量が相違')));expect(conflicts).toHaveLength(2);expect(conflicts.every(i=>i.calories===null)).toBe(true);expect(rows.some(i=>i.size.startsWith('朝食 / '))).toBe(true);});
  it.each(['ガスト','天下一品','餃子の王将','スシロー','くら寿司','はま寿司'])('%s 不足値を0にせず全商品カート登録拒否', chain => { for(const item of chainItems(chain)){expect(isComplete(item)).toBe(false);expect(()=>changeCart([],item,1)).toThrow();} });
  it('ジョイフルはPFC付き、かつ持ち帰りと店内を区別', () => {const rows=chainItems('ジョイフル');expect(rows.every(isComplete)).toBe(true);expect(rows.some(i=>i.size.startsWith('持ち帰り'))).toBe(true);expect(rows.some(i=>i.size.startsWith('店内'))).toBe(true);});
});

describe('第3A-3 共通カート・保存の回帰', () => {
  it.each(['official_old','secondary','estimate'] as const)('%s 混在時の代表出典とsnapshot', async type => {const item=structuredClone(joy);item.nutrientProvenance.protein.sourceType=type;item.nutrientProvenance.protein.notes=['テスト専用の出典混在fixture'];expect(menuSourceType(item)).toBe(type);const [saved]=await registerRestaurantOrder([{item,quantity:2}],context);expect(saved.sourceType).toBe(type);expect(saved.restaurantSnapshot?.nutrientProvenance.protein.sourceType).toBe(type);});
  it('数値が入っていてもunknown provenanceは拒否', () => {const item=structuredClone(joy);item.nutrientProvenance.protein.sourceType='unknown';expect(()=>completeNutrients(item)).toThrow();expect(isComplete(item)).toBe(false);});
  it('出典と数値の不一致を拒否', () => {const item=structuredClone(joy);item.protein=999;expect(()=>completeNutrients(item)).toThrow();});
  it('数量の増減・削除・kcal/PFC合計', () => {const b=chainItems('ジョイフル')[1];let cart=changeCart([],joy,1);cart=changeCart(cart,b,2);cart=changeCart(cart,joy,3);for(const k of nutrientKeys)expect(cartTotal(cart)[k]).toBeCloseTo(joy[k]!*3+b[k]!*2);expect(changeCart(cart,b,0)).toHaveLength(1);});
  it('皿数と貫数は既存quantityで計算（実DBと分離した計算用fixture）', async () => {const item={...structuredClone(joy),name:'計算専用fixture・実メニューではない',quantityUnit:'皿',servingBasis:'2貫／1皿',piecesPerServing:2};const line={item,quantity:3};expect(quantityLabel(line)).toBe('3皿');expect(piecesLabel(line)).toBe('合計 6貫相当');expect(cartTotal([line]).calories).toBe(item.calories!*3);const [saved]=await registerRestaurantOrder([line],context);expect(saved.restaurantSnapshot?.piecesPerServing).toBe(2);expect(saved.restaurantSnapshot?.servingBasis).toBe('2貫／1皿');});
  it('貫数が不明なら合計貫数を作らない・旧単位は互換', () => {expect(piecesLabel({item:joy,quantity:3})).toBe('');const old={...joy};delete old.quantityUnit;expect(quantityLabel({item:old,quantity:3})).toBe('3');});
  it('注文グループ・snapshot・後日の公式値更新と再起動を分離', async () => {const item=structuredClone(joy);const saved=await registerRestaurantOrder([{item,quantity:2},{item:chainItems('ジョイフル')[1],quantity:1}],context);expect(new Set(saved.map(i=>i.restaurantOrderId)).size).toBe(1);item.name='変更後';item.calories=999;item.servingBasis='変更後の単位';db.close();const reopened=new MealLogDatabase();try{expect(await reopened.meals.get(saved[0].id)).toEqual(saved[0]);expect(reopened.verno).toBe(3);}finally{reopened.close();}});
  it('未知商品を含む注文の一部保存も拒否', async () => {await expect(registerRestaurantOrder([{item:joy,quantity:1},{item:chainItems('スシロー')[0],quantity:3}],context)).rejects.toThrow();expect(await db.meals.count()).toBe(0);});
  it('登録不可商品の店舗・商品お気に入りは保存・解除可能', async () => {const item=chainItems('スシロー')[0];const store=await saveFavorite('restaurant',item.restaurantId,1),menu=await saveFavorite('restaurantMenu',item.id,1);expect(await db.favorites.count()).toBe(2);await removeFavorite(store.id);await removeFavorite(menu.id);expect(await db.favorites.count()).toBe(0);});
  it('最近使った店を注文単位で導出し前日コピーも保持', async () => {const saved=await registerRestaurantOrder([{item:joy,quantity:2},{item:chainItems('ジョイフル')[1],quantity:1}],context);expect(recentRestaurants(saved)[0].count).toBe(1);expect(await copyPreviousDay('2026-09-10',['lunch'])).toEqual({copied:2,skipped:0});const copy=(await db.meals.toArray()).find(i=>i.copiedFromId===saved[0].id)!;expect(copy.restaurantSnapshot).toEqual(saved[0].restaurantSnapshot);expect(copy.restaurantOrderId).not.toBe(saved[0].restaurantOrderId);});
});
