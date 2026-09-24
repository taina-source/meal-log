import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { normalizeSeries, normalizeSectionOrder, moveSection, defaultSectionOrder, intakeSeries } from '../domain/analysisDisplay';
import { chartAxes } from '../domain/chartAxes';
import { analysisPolicy, analysisRange, mealSummary } from '../domain/analysis';
import { MealLogDatabase } from './db';
import { saveAnalysisDisplay } from './analysisDisplay';
import { defaultSettings } from '../domain/types';
import { exportBackup, restoreBackup, backupText } from './backup';
let database: MealLogDatabase;
beforeEach(()=>{ database = new MealLogDatabase('analysis-display-test'); });
afterEach(()=>database.delete());
const records = [{date:'2026-09-23',count:1,calories:2000,protein:100,fat:50,carbs:250},{date:'2026-09-21',count:1,calories:0,protein:0,fat:0,carbs:0}].reverse();
it.each(Array.from({length:16},(_,i)=>i))('系列選択 %i と単位別の軸',mask=>{
  const visibility={calories:!!(mask&1),protein:!!(mask&2),fat:!!(mask&4),carbs:!!(mask&8)};
  const lines=intakeSeries(records,analysisPolicy(),normalizeSeries(visibility));
  expect(lines).toHaveLength(Object.values(visibility).filter(Boolean).length);
  expect(lines.map(l=>l.name)).toEqual(['kcal','P','F','C'].filter((_,i)=>mask&(1<<i)));
  if(!mask)return;
  const axes=chartAxes(lines,visibility.calories?'kcal':'g',true,visibility.calories?2400:undefined);
  expect(axes.map(a=>a.unit)).toEqual(visibility.calories ? mask>1?['kcal','g']:['kcal'] : ['g']);
  expect(axes.every(a=>Number.isFinite(a.min)&&a.max>a.min)).toBe(true);
  if(axes.length===2){expect(axes[0].max).toBeGreaterThanOrEqual(2400);expect(axes[1].max).toBeLessThan(1000);}
});
it.each([7,30,90,'all'] as const)('%s期間・欠損点を生成せず0と除外日を保持',period=>{
  const range=analysisRange(period,'2026-09-23',records.map(r=>r.date));
  const summary=mealSummary(records,range,analysisPolicy());
  const lines=intakeSeries(summary.records,analysisPolicy(),normalizeSeries({protein:true}));
  expect(lines[1].points).toEqual([{date:'2026-09-21',value:0,excluded:true},{date:'2026-09-23',value:100,excluded:false}]);
  expect(summary.eligibleDays).toBe(1);
});
it('旧・不正Settingsを安全に正規化、全OFFは維持',()=>{
  expect(normalizeSeries(null)).toEqual({calories:true,protein:false,fat:false,carbs:false});
  expect(normalizeSeries({calories:'false',protein:1})).toEqual(normalizeSeries(undefined));
  expect(normalizeSectionOrder(['waist','unknown','waist',null])).toEqual(['waist',...defaultSectionOrder.filter(id=>id!=='waist')]);
  expect(normalizeSectionOrder({})).toEqual(defaultSectionOrder);
});
it('移動・先頭末尾・初期順への正規化',()=>{
  const moved=moveSection(defaultSectionOrder,'intake',-1);
  expect(moved.indexOf('intake')).toBe(2);
  expect(moveSection(moved,'intake',1)).toEqual(defaultSectionOrder);
  expect(moveSection(defaultSectionOrder,'maintenance',-1)).toEqual(defaultSectionOrder);
  expect(moveSection(defaultSectionOrder,'trends',1)).toEqual(defaultSectionOrder);
  expect(normalizeSectionOrder([])).toEqual(defaultSectionOrder);
});
it('保存・再接続・個別patchで他設定を保持',async()=>{
  await database.settings.put({...defaultSettings,id:'user',calorieTarget:3000,theme:'dark',analysisMinimumCalories:1700});
  await Promise.all([saveAnalysisDisplay({series:{protein:true}},database),saveAnalysisDisplay({order:['waist']},database)]);
  database.close();await database.open();const row=await database.settings.get('user');
  expect(row).toMatchObject({calorieTarget:3000,theme:'dark',analysisMinimumCalories:1700,analysisSeries:{protein:true}});
  expect(row?.analysisSectionOrder?.[0]).toBe('waist');
  await saveAnalysisDisplay({order:defaultSectionOrder},database);expect((await database.settings.get('user'))?.analysisSeries?.protein).toBe(true);
});
it('未保存Settingsへの既定値とJSONバックアップ復元',async()=>{
  await saveAnalysisDisplay({series:{calories:false,carbs:true},order:['intake']},database);
  const original=await database.settings.get('user');
  const backup=JSON.parse(backupText(await exportBackup(database,'2026-09-23T00:00:00Z')));
  await saveAnalysisDisplay({series:{calories:true}},database);
  await restoreBackup(backup,database);expect(await database.settings.get('user')).toEqual(original);
});
