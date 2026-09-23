import { expect, it } from 'vitest';
import { buildMonthCalendar, shiftMonth } from './calendar';
import type { MealEntry, WeightEntry } from './types';
const meal = (date: string, calories: number, extra = {}): MealEntry => ({ id: date, name: '記録', restaurant: '', eatenAt: new Date(`${date}T00:15:00`).toISOString(), calories, protein: 0, fat: 0, carbs: 0, mealType: 'lunch', sourceType: 'manual', confidence: null, createdAt: '', updatedAt: '', ...extra });
it.each([['2026-09',30,2,35],['2026-02',28,0,28],['2024-02',29,4,35],['2026-08',31,6,42]])('%sの暦日・日曜始まり・空セル', (month,count,offset,cells) => {
  const result=buildMonthCalendar(month,[],[]);expect(result).toHaveLength(cells);expect(result.filter(Boolean)).toHaveLength(count);expect(result.findIndex(Boolean)).toBe(offset);expect(result[offset]?.date).toBe(`${month}-01`);
});
it('月初基準で年跨ぎ・31日問題を回避',()=>{expect(shiftMonth('2026-01',-1)).toBe('2025-12');expect(shiftMonth('2026-12',1)).toBe('2027-01');expect(shiftMonth('2026-01',1)).toBe('2026-02');});
it('ローカル日・区分混在・保存済み値を集計しsnapshotや低カロリー除外を使わない',()=>{
  const meals=[meal('2026-09-10',100.25),meal('2026-09-10',200.5,{mealType:'dinner',chatgptSnapshot:{calories:999}}),meal('2026-10-01',999)];
  const before=structuredClone(meals),days=buildMonthCalendar('2026-09',meals,[]);
  expect(days.find(d=>d?.date==='2026-09-10')).toMatchObject({mealCount:2,calories:300.75});expect(meals).toEqual(before);
});
it('0kcal記録・未記録・保存済み未来日を区別',()=>{
  const days=buildMonthCalendar('2099-09',[meal('2099-09-10',0)],[]);
  expect(days.find(d=>d?.date==='2099-09-10')).toMatchObject({mealCount:1,calories:0});expect(days.find(d=>d?.date==='2099-09-11')).toMatchObject({mealCount:0,calories:null});
});
it.each([{weightKg:80},{bodyFatPercent:20},{waistCm:90},{weightKg:80,bodyFatPercent:20,waistCm:90},{weight:80}])('身体測定・旧weight互換 %j',values=>{
  const record:WeightEntry={id:'w',date:'2026-09-10',createdAt:'',...values};
  expect(buildMonthCalendar('2026-09',[],[record]).find(d=>d?.date===record.date)?.hasMeasurement).toBe(true);
});
it('空指標・非有限・期間外はmarkerなし、Health metadataは無関係',()=>{
  const rows:WeightEntry[]=[{id:'1',date:'2026-09-10',createdAt:'',healthExport:{weightKg:{value:80,exportedAt:''}}},{id:'2',date:'2026-09-11',createdAt:'',weightKg:NaN},{id:'3',date:'2026-08-10',createdAt:'',waistCm:90}];
  expect(buildMonthCalendar('2026-09',[],rows).some(d=>d?.hasMeasurement)).toBe(false);
});
