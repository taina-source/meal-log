import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from './db';
import { registerSuggestion } from './suggestions';
import { normalSources, expandForReview, catalogPart, restaurantSources } from '../domain/suggestionSources';
import { recipeItem } from '../domain/foods';
import { registerChatgpt } from './chatgpt';
import { readChatgptJson } from '../domain/chatgpt';
import { favoriteSavedMeal } from './reuseMeals';
import { getDayMeals } from './repository';
import { registerRestaurantOrder } from './restaurantRepository';
import kfc from '../../public/data/restaurants/kfc.json';
import type { MealEntry } from '../domain/types';
import type { MealSet, Recipe, RestaurantDataset } from '../domain/catalog';
const context = { date: '2026-09-17', time: '12:00', mealType: 'lunch' as const };
const meal:MealEntry={id:'manual',name:'手入力',restaurant:'',calories:600,protein:30,fat:20,carbs:75,sourceType:'manual',quantity:2,unit:'item',confidence:null,mealType:'dinner',eatenAt:'2026-09-16T10:00:00Z',createdAt:'2026-09-16T10:00:00Z',updatedAt:'2026-09-16T10:00:00Z'};
beforeEach(async()=>{await db.meals.clear();await db.favorites.clear();});
it('候補生成/詳細展開だけでは保存せず、確認後だけ登録',async()=>{const parts=normalSources([],[],[],[],[meal],0);expandForReview(parts);expect(await db.meals.count()).toBe(0);await registerSuggestion(parts,[2],context);expect(await db.meals.count()).toBe(1);});
it('手入力の最終値を量比で再計算、元履歴は不変でHomeに反映',async()=>{await db.meals.add(meal);const p=normalSources([],[],[],[],[meal],0);const [next]=await registerSuggestion(p,[3],context);expect(next.calories).toBe(900);expect(next.protein).toBe(45);expect(next.sourceType).toBe('manual');expect(next.id).not.toBe(meal.id);expect(await db.meals.get(meal.id)).toEqual(meal);expect(await getDayMeals(context.date)).toHaveLength(1);});
it('ChatGPT修正後合計を再乗算せず再利用し元snapshotを保持',async()=>{
  const receipt=readChatgptJson(JSON.stringify({schemaVersion:1,type:'meal-log-chatgpt',inputType:'photo',items:[{name:'写真料理',quantity:2,unit:'皿',calories:500,protein:30,fat:20,carbs:50,sourceType:'estimate',confidence:'medium'}]}));
  const [original]=await registerChatgpt(receipt,receipt.payload!.items.map(i=>({...i,calories:620})),{...context,date:'2026-09-16'});
  const f=await favoriteSavedMeal(original);const stored=structuredClone(f);
  const p=normalSources([],[],[],[f],[],0);const [next]=await registerSuggestion(p,[original.quantity!],context);
  expect(next.calories).toBe(1240);expect(next.chatgptSnapshot).toEqual(original.chatgptSnapshot);expect(next.chatgptImportId).not.toBe(original.chatgptImportId);expect(next.chatgptUserModified).toBe(true);expect(await db.favorites.get(f.id)).toEqual(stored);
});
it('食品の版と注記・レシピsnapshot・セットgroupを既存処理で保存',async()=>{
  const recipe:Recipe={id:'r',name:'料理',servings:2,ingredients:[{id:'ing',foodId:'f',name:'食品',grams:100,per100g:{calories:600,protein:30,fat:20,carbs:75},sourceVersion:'mext',notes:['公式推定']}],createdAt:'a',updatedAt:'a'};
  const food={id:'f',kind:'food' as const,sourceId:'food',name:'食品',quantity:100,unit:'g' as const,nutrients:{calories:100,protein:5,fat:1,carbs:15},sourceVersion:'mext',notes:['Tr注記']};
  const set:MealSet={id:'set',name:'いつもの',items:[food,recipeItem(recipe,.5,'r')],total:{calories:400,protein:20,fat:11,carbs:52.5},createdAt:'a',updatedAt:'a'};
  const parts=expandForReview(normalSources([],[],[set],[],[],0));const entries=await registerSuggestion(parts,parts.map(p=>p.quantity),context);
  expect(entries).toHaveLength(2);expect(new Set(entries.map(e=>e.setRunId)).size).toBe(1);expect(entries[0].setId).toBe('set');expect(entries.find(e=>e.sourceType==='database')?.notes).toEqual(['Tr注記']);expect(entries.find(e=>e.sourceType==='recipe')?.recipeSnapshot).toEqual(recipe);
});
it('組み合わせの後半が保存不可でも一部保存しない',async()=>{
  const good=catalogPart({id:'i',kind:'food',sourceId:'f',name:'食品',quantity:100,unit:'g',nutrients:{calories:100,protein:10,fat:1,carbs:10}});
  const bad={...good,id:'bad',source:{...good.source}};if(bad.source.kind==='catalog') bad.source.item={...bad.source.item,name:'x'.repeat(101)};
  await expect(registerSuggestion([good,bad],[100,100],context)).rejects.toThrow();expect(await db.meals.count()).toBe(0);
});
it('外食候補は既存カート保存でquantityとprovenanceを保持',async()=>{
  const data=kfc as RestaurantDataset;
  const p=restaurantSources(data.items)[0];if(p.source.kind!=='restaurant') throw Error();const item=p.source.item;
  const [entry]=await registerRestaurantOrder([{item,quantity:2}],context);
  expect(entry.calories).toBe(p.nutrients.calories*2);expect(entry.restaurantSnapshot).toEqual(item);expect(entry.nutrientProvenance).toEqual(item.nutrientProvenance);
});
