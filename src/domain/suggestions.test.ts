import { expect, it } from 'vitest';
import { allGoalsReached, discreteGrams, nearGoal, normalizedError, nutritionScore, rankSuggestions, remainingTargets, suggestionSections, usualFactor, validCandidate, type SuggestionPart } from './suggestions';
import { catalogPart, editablePart, expandForReview, normalSources, restaurantSources } from './suggestionSources';
import type { Food, MealSet, RestaurantMenuItem } from './catalog';
import type { MealEntry, Nutrients } from './types';
const goals = { calories: 2000, protein: 100, fat: 60, carbs: 250 };
const n = (calories = 300, protein = 20, fat = 5, carbs = 30): Nutrients => ({ calories, protein, fat, carbs });
const part = (id: string, nutrients = n()): SuggestionPart => ({ id, sourceKey: id, name: id, quantity: 1, unitLabel: '個', nutrients, favorite: false, recent: false, prepared: false, preferred: false });
const meal: MealEntry = { id: 'm', name: '保存料理', restaurant: '', ...n(), sourceType: 'manual', confidence: null, quantity: 2, unit: 'item', mealType: 'lunch', eatenAt: '2026-09-17T03:00:00Z', createdAt: '2026-09-17T03:00:00Z', updatedAt: '2026-09-17T03:00:00Z' };
const food: Food = { id: 'f', name: '食品', category: '1', aliases: [], caloriesPer100g: 100, proteinPer100g: 10, fatPer100g: 1, carbsPer100g: 15, source: 'MEXT', sourceVersion: 'v', raw: { calories: '100', protein: '10', fat: '1', carbs: '15' }, status: { calories: 'numeric', protein: 'numeric', fat: 'numeric', carbs: 'numeric' } };
it.each([n(1000, 50, 30, 100), goals, n(2200, 120, 70, 270), n(2200, 50, 70, 270)])('残りは丸めず正負を維持 %o', consumed => {
  const r = remainingTargets(goals, consumed); for (const k of ['calories','protein','fat','carbs'] as const) expect(r[k]).toBe(goals[k] - consumed[k]);
});
it('不足に比べ超過は正確に1.35倍', () => { expect(normalizedError(100, 0, 1000, 100)).toBe(1); expect(normalizedError(100, 200, 1000, 100)).toBe(1.35); });
it('0近傍・小目標もfloorで正規化', () => { expect(normalizedError(0, 10, 0, 10)).toBe(1.35); expect(normalizedError(1, 0, 1, 10)).toBe(.1); });
it.each([NaN, Infinity, -Infinity])('非有限入力からNaN/Infinityを返さない %s', v => { expect(Number.isFinite(normalizedError(v, 1, 1, 10))).toBe(true); });
it('各モードのweight', () => {
  const r = n(100, 10, 5, 10), zero = n(0,0,0,0), g = n(100,10,5,10);
  expect(nutritionScore(zero, r, g, 'balanced')).toBeCloseTo(1);
  for (const [key, balanced, protein] of [['calories',.4,.3],['protein',.3,.45],['fat',.15,.15],['carbs',.15,.1]] as const) {
    expect(nutritionScore({ ...r, [key]: 0 }, r, g, 'balanced')).toBeCloseTo(balanced);
    expect(nutritionScore({ ...r, [key]: 0 }, r, g, 'protein')).toBeCloseTo(protein);
  }
});
it('残りに近い候補が上位', () => { expect(rankSuggestions([part('bad',n(2000)),part('good',n())], n(), goals,'balanced')[0].parts[0].id).toBe('good'); });
it('P重視はPを優先するが極端なkcal/F超過は避ける', () => {
  const r = n(400,40,10,50), a = part('calories',n(400,0,10,50)), b = part('protein',n(0,40,10,50));
  expect(rankSuggestions([a,b],r,goals,'balanced',false)[0].id).toBe('calories');
  expect(rankSuggestions([a,b,part('excess',n(9000,40,500,50))],r,goals,'protein',false)[0].id).toBe('protein');
});
it('usual補正は最強の1つのみ', () => {
  const p = part('p'); expect(usualFactor([{...p,favorite:true,recent:true,prepared:true}])).toBe(.85);
  expect(usualFactor([{...p,recent:true,prepared:true}])).toBe(.9); expect(usualFactor([{...p,prepared:true}])).toBe(.95); expect(usualFactor([p])).toBe(1);
});
it('usualは同等ならfavorite、極端な悪候補を逆転させない', () => {
  const p = part('plain'), f = {...part('fav'),favorite:true};
  expect(rankSuggestions([p,f],n(600,40,10,60),goals,'usual',false)[0].id).toBe('fav');
  expect(rankSuggestions([part('good'),{...f,nutrients:n(10000)}],n(),goals,'usual',false)[0].id).toBe('good');
});
it.each(['calories','protein','fat','carbs'] as const)('null %sは除外', key => { expect(validCandidate({...n(),[key]:null})).toBe(false); });
it('全0・負値・非有限も除外', () => { expect(validCandidate(n(0,0,0,0))).toBe(false); expect(validCandidate(n(-1))).toBe(false); expect(validCandidate(n(Infinity))).toBe(false); });
it('MEXTは25g刻み400gまで、過去量を先頭で維持', () => { const grams=discreteGrams(180); expect(grams[0]).toBe(180); expect(grams.slice(1).every(g=>g%25===0 && g<=400)).toBe(true); });
it('過去の個数・未知単位をg変換せず元量だけ候補化', () => {
  const parts=normalSources([],[],[],[],[meal,{...meal,id:'unknown',unit:undefined,quantity:1}],0); expect(parts).toHaveLength(2); expect(parts.find(p=>p.sourceKey==='saved:m')).toMatchObject({quantity:2,unitLabel:'個',preferred:true});
});
it('1/2/3品生成・同source重複禁止・組み合わせdedupe', () => {
  const p=[part('a'),part('b'),part('c'),{...part('a2'),sourceKey:'a',quantity:2}];
  const ranked=rankSuggestions([...p,p[0]],n(900,60,15,90),goals,'balanced');
  expect(new Set(ranked.map(c=>c.parts.length))).toEqual(new Set([1,2,3]));
  expect(new Set(ranked.map(c=>c.id)).size).toBe(ranked.length); expect(ranked.every(c=>new Set(c.parts.map(p=>p.sourceKey)).size===c.parts.length)).toBe(true);
});
it('poolは24distinct・2量まで、並び順に依存しない', () => {
  const p=Array.from({length:30},(_,i)=>[1,2,3].map(q=>({...part(`${String(i).padStart(2,'0')}:${q}`),sourceKey:String(i),quantity:q}))).flat();
  const a=rankSuggestions(p,n(900,60,15,90),goals,'balanced'), b=rankSuggestions([...p].reverse(),n(900,60,15,90),goals,'balanced');
  expect(a).toEqual(b); expect(a.length).toBeLessThanOrEqual(60);
  const combo=a.filter(c=>c.parts.length>1).flatMap(c=>c.parts); expect(new Set(combo.map(p=>p.sourceKey)).size).toBeLessThanOrEqual(24);
  for(const key of new Set(combo.map(p=>p.sourceKey))) expect(new Set(combo.filter(p=>p.sourceKey===key).map(p=>p.quantity)).size).toBeLessThanOrEqual(2);
});
it('セクションは最大5、同一候補を重複させない',()=>{const sections=suggestionSections(Array.from({length:10},(_,i)=>part(String(i),n(100+i*10))),n(900,60,15,90),goals);const ids=sections.flatMap(s=>s.candidates.map(c=>c.id));expect(new Set(ids).size).toBe(ids.length);expect(sections.every(s=>s.candidates.length<=5)).toBe(true);});
it('±10%全項目のみnear、全remaining<=0でcollapsed',()=>{expect(nearGoal(n(200,-10,6,-25),goals)).toBe(true);expect(nearGoal(n(201,-10,6,-25),goals)).toBe(false);expect(allGoalsReached(n(0,-1,0,-1))).toBe(true);expect(allGoalsReached(n(-150,20,-10,-20))).toBe(false);});
it('kcal超過/P不足の混在も候補生成できる',()=>{expect(rankSuggestions([part('p')],n(-150,20,-10,-20),goals,'protein')).toHaveLength(1);});
it('不正目標では候補を出さない',()=>{expect(rankSuggestions([part('p')],n(),n(NaN),'balanced')).toEqual([]);});
it('食品unknownを0にせず除外、保存済み量は元の最終値',()=>{
  expect(normalSources([{...food,proteinPer100g:null}],[],[],[],[],0)).toEqual([]);
  const saved={...meal,sourceType:'database' as const,sourceId:'f',quantity:180,unit:'g' as const};
  const p=normalSources([food],[],[],[],[saved],0).find(p=>p.quantity===180)!;expect(p.nutrients.calories).toBe(300);expect(p.preferred).toBe(true);
});
it('同時刻のrecentもIDで安定し、入力配列順に依存しない',()=>{
  const a={...meal,id:'a',sourceType:'database' as const,sourceId:'f',unit:'g' as const,quantity:100},b={...a,id:'b',quantity:200};
  expect(normalSources([food],[],[],[],[a,b],0)).toEqual(normalSources([food],[],[],[],[b,a],0));
});
it('レシピの編集量は既存の全体割合上限を維持',()=>{
  const p=catalogPart({id:'r',kind:'recipe',sourceId:'r',name:'料理',quantity:.5,unit:'whole',nutrients:n()});
  expect(()=>editablePart(p,101)).toThrow();expect(editablePart(p,1).nutrients.calories).toBe(600);
});
it('お気に入りsnapshotは元履歴より優先、元データを変更しない',()=>{
  const snapshot={...meal,calories:450}, before=structuredClone(snapshot);
  const p=normalSources([],[],[],[{id:'fav',kind:'manualMeal',sourceId:'m',quantity:1,createdAt:meal.createdAt,mealSnapshot:snapshot}],[meal],0)[0];
  expect(p.nutrients.calories).toBe(450); expect(editablePart(p,4).nutrients.calories).toBe(900);expect(snapshot).toEqual(before);
});
it('セットは内容を変更せず確認画面で構成品へ展開',()=>{
  const item=catalogPart({id:'i',kind:'food',sourceId:'f',name:'食品',quantity:100,unit:'g',nutrients:n()});
  const set:MealSet={id:'s',name:'セット',items:[item.source.kind==='catalog'?item.source.item: (()=>{throw Error();})()],total:n(),createdAt:'a',updatedAt:'a'};
  const p=normalSources([],[],[set],[],[],0);expect(expandForReview(p)[0].set?.id).toBe('s');expect(p[0].quantity).toBe(1);
});
it('外食は完全・登録可のみ、単品候補で店舗間comboなし',()=>{
  const values=n(), provenance=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value,sourceType:'official'}]));
  const menu={id:'menu',restaurantId:'kfc',name:'商品',...values,nutrientProvenance:provenance} as RestaurantMenuItem;
  const p=restaurantSources([menu,{...menu,id:'null',protein:null},{...menu,id:'blocked',registrationBlockedReason:'不可'},{...menu,id:'other',restaurantId:'mos'}]);expect(p).toHaveLength(2);
  expect(rankSuggestions(p,n(),goals,'balanced',false).every(c=>c.parts.length===1)).toBe(true);
});
