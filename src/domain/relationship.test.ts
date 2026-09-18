import { expect, it } from 'vitest';
import { weeklyBlocks, rankValues, calculateSpearman, calorieWeightRelationship } from './relationship';
import { analysisRange, dateRange, dailyWeights, type MealDay } from './analysis';
import { shiftDate } from './date';
const end = '2026-09-19', range = dateRange('2026-09-13', end);
const meals = (n=7, kcal=2000): MealDay[] => Array.from({length:n},(_,i)=>({date:shiftDate(end,-i),count:1,calories:kcal,protein:100,fat:50,carbs:200}));
const weights = [{date:'2026-09-13',weight:80},{date:'2026-09-17',weight:80.4}];
it('終了日から完全7日を生成し余りを除外、境界は重ならない',()=>{
 const b=weeklyBlocks(analysisRange(30,end,[]));expect(b).toHaveLength(4);expect(b[0].start).toBe('2026-08-23');expect(b.at(-1)?.end).toBe(end);
 for(let i=1;i<b.length;i++) expect(shiftDate(b[i-1].end,1)).toBe(b[i].start);
 expect(weeklyBlocks(dateRange(end,end))).toEqual([]);
});
it.each([5,7])('食事%i日の実際の分母で計算',n=>{const r=calorieWeightRelationship(meals(n),weights,range);expect(r.points[0]).toMatchObject({averageCalories:2000,foodDayCount:n,weightDayCount:2,weightSpanDays:4});expect(r.points[0].weightTrendKgPerWeek).toBeCloseTo(.7);});
it('4食事日は除外',()=>expect(calorieWeightRelationship(meals(4),weights,range).points).toEqual([]));
it('低カロリー閾値の境界とOFFを既存集計で処理',()=>{
 expect(calorieWeightRelationship(meals(7,1500),weights,range).points).toEqual([]);
 expect(calorieWeightRelationship(meals(5,1501),weights,range).points[0].averageCalories).toBe(1501);
 expect(calorieWeightRelationship(meals(5,1500),weights,range,{enabled:false,threshold:1500}).points[0].averageCalories).toBe(1500);
});
it.each([[weights.slice(0,1)],[[weights[0],{date:'2026-09-16',weight:81}]]])('体重1日または間隔3日は除外',w=>expect(calorieWeightRelationship(meals(),w,range).points).toEqual([]));
it('ブロック外データや身体測定の他指標は使わない',()=>{
 const w=dailyWeights([{id:'a',date:end,bodyFatPercent:20,waistCm:90,createdAt:''}]);expect(w).toEqual([]);
 expect(calorieWeightRelationship(meals(),[...w,{date:'2026-09-12',weight:80}],range).points).toEqual([]);
});
it('体重全ペアのTheil–Senを使い内部丸めしない',()=>{
 const w=[{date:'2026-09-13',weight:80},{date:'2026-09-15',weight:100},{date:'2026-09-19',weight:81}];
 expect(calorieWeightRelationship(meals(),w,range).points[0].weightTrendKgPerWeek).toBeCloseTo(7/6, 12);
});
it('非有限平均・トレンドは有効点にならない',()=>{
 expect(calorieWeightRelationship(meals(7,Infinity),weights,range).points).toEqual([]);
 expect(calorieWeightRelationship(meals(),[{...weights[0],weight:NaN},weights[1]],range).points).toEqual([]);
});
it('average rankと入力不変',()=>{const v=[100,200,200,400];expect(rankValues(v)).toEqual([1,2.5,2.5,4]);expect(v).toEqual([100,200,200,400]);});
it.each([1,-1])('完全相関%i',sign=>expect(calculateSpearman([1,2,3,4,5].map(x=>({x,y:sign*x})))).toBe(sign));
it('tieの順位相関は丸めない',()=>expect(calculateSpearman([1,2,2,4,5].map((x,i)=>({x,y:i+1})))).toBeCloseTo(9.5/Math.sqrt(95),14));
it.each(['x','y'] as const)('全%s同値はnull',axis=>expect(calculateSpearman([1,2,3,4,5].map(v=>({x:axis==='x'?1:v,y:axis==='y'?1:v})))).toBeNull());
it('非有限と4点以下を安全に拒否',()=>{
 expect(rankValues([NaN])).toBeNull();expect(calculateSpearman([1,2,3,4,Infinity].map(x=>({x,y:x})))).toBeNull();expect(calculateSpearman([1,2,3,4].map(x=>({x,y:x})))).toBeNull();
});
it('選択期間で再計算、90日と全期間、5週以上のみrho',()=>{
 const m:MealDay[]=[],w:typeof weights=[];
 for(let i=0;i<6;i++) {const e=shiftDate(end,-i*7);for(let d=0;d<7;d++)m.push({...meals(1)[0],date:shiftDate(e,-d),calories:2000+i*100});w.push({date:shiftDate(e,-6),weight:80},{date:e,weight:80+i*.1});}
 expect(calorieWeightRelationship(m,w,analysisRange(30,end,[])).rho).toBeNull();
 for(const r of [analysisRange(90,end,[]),analysisRange('all',end,m.map(x=>x.date))]){const result=calorieWeightRelationship(m,w,r);expect(result.points).toHaveLength(6);expect(result.rho).toBe(1);}
 expect(calorieWeightRelationship(m,w,analysisRange(7,end,[])).points).toHaveLength(1);
});
