import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { MealLogDatabase } from './db';
import { exportBackup, restoreBackup, backupText, readBackupFile } from './backup';
import { backupCounts, backupFilename, backupLimit, backupTables, makeBackup, parseBackup, validateBackup, type BackupData } from '../domain/backup';
import { defaultSettings, type MealEntry } from '../domain/types';
import { sampleRecipe } from '../testing/fixtures';
import { recipeItem } from '../domain/foods';
import kfc from '../../public/data/restaurants/kfc.json';
import type { RestaurantMenuItem } from '../domain/catalog';
import { completeNutrients } from '../domain/restaurantMenus';
const stamp='2026-09-18T03:30:00.000Z';
let database:MealLogDatabase, other:MealLogDatabase;
const manual:MealEntry={id:'meal',name:'食事',restaurant:'',calories:600,protein:30,fat:20,carbs:75,mealType:'lunch',eatenAt:stamp,createdAt:stamp,updatedAt:stamp,sourceType:'manual',confidence:null};
function fixture():BackupData {
  const recipe=sampleRecipe(), item=recipeItem(recipe,.5,'set-item'), restaurant=kfc.items[0] as RestaurantMenuItem;
  const chat:MealEntry={...manual,id:'chat',sourceType:'chatgpt',chatgptImportId:'import-id',chatgptUserModified:true,quantity:2,unit:'item',chatgptUnit:'皿',chatgptSnapshot:{schemaVersion:1,inputType:'photo',name:'元の料理',restaurant:'',calories:null,protein:20,fat:10,carbs:40,quantity:1,unit:'皿',declaredSourceType:'estimate',sourceUrl:'',sourceTitle:'',confidence:'medium',notes:'推定量',importedAt:stamp}};
  return {meals:[manual,chat,{...manual,id:'restaurant',...completeNutrients(restaurant),sourceType:'official',restaurantOrderId:'order-id',restaurantId:restaurant.restaurantId,restaurantSnapshot:restaurant,nutrientProvenance:restaurant.nutrientProvenance}],weights:[{id:'weight',date:'2026-09-18',weight:100,bodyFatPercent:24,waistCm:98,createdAt:stamp,healthExport:{weightKg:{value:100,exportedAt:stamp},bodyFatPercent:{value:24,exportedAt:stamp},waistCm:{value:98,exportedAt:stamp}}}],settings:[{...defaultSettings,id:'user',pendingHealthExport:{createdAt:stamp,mode:'unshared',recordIds:{},payload:{schemaVersion:1,type:'meal-log-health-batch',exportId:'pending',measurements:[{date:'2026-09-18',weightKg:100}]}}}],recipes:[recipe],mealSets:[{id:'set',name:'セット',items:[item],total:item.nutrients,createdAt:stamp,updatedAt:stamp}],favorites:[{id:'favorite',kind:'chatgptMeal',sourceId:'chat',quantity:1,createdAt:stamp,mealSnapshot:chat}]};
}
async function seed(data=fixture(), target=database){for(const table of backupTables)await target.table(table).bulkAdd(data[table]);}
async function raw(target=database){return Object.fromEntries(await Promise.all(backupTables.map(async t=>[t,await target.table(t).toArray()])));}
beforeEach(()=>{database=new MealLogDatabase('backup-test-a');other=new MealLogDatabase('backup-test-b');});
afterEach(async()=>{await database.delete();await other.delete();});
it('format/type/dbVersion/exportedAtと6collectionを明示、静的catalogを含めない',async()=>{await seed();const b=await exportBackup(database,stamp);expect(b).toMatchObject({type:'meal-log-backup',formatVersion:1,dbVersion:3,exportedAt:stamp,app:{name:'Meal Log'}});expect(Object.keys(b.data).sort()).toEqual([...backupTables].sort());expect(database.verno).toBe(3);});
it('exportはID/snapshot/完了metadataを保持しpendingだけ除外、DBを更新しない',async()=>{await seed();const before=await raw(),b=await exportBackup(database,stamp);expect(b.data.meals).toEqual(before.meals);expect(b.data.weights).toEqual(before.weights);expect(b.data.favorites).toEqual(before.favorites);expect(b.data.settings[0].pendingHealthExport).toBeUndefined();expect(await raw()).toEqual(before);});
it('JSON round tripと件数previewは書込みなし',async()=>{await seed();const before=await raw(),b=await exportBackup(database,stamp);const parsed=parseBackup(backupText(b));expect(parsed).toEqual(b);expect(backupCounts(parsed)).toEqual({meals:3,weights:1,settings:1,recipes:1,favorites:1,mealSets:1});expect(await raw()).toEqual(before);});
it('ローカル時刻ファイル名',()=>{expect(backupFilename(new Date(2026,8,18,21,30))).toBe('meal-log-backup-2026-09-18-2130.json');});
it('空DBもバックアップ・復元できる',async()=>{const b=await exportBackup(database,stamp);await seed(fixture(),other);await restoreBackup(b,other);expect((await exportBackup(other,stamp)).data).toEqual(b.data);});
it.each(['{broken','{"type":"meal-log-chatgpt","schemaVersion":1,"items":[]}','{"type":"meal-log-meal","items":[]}'])('異なるJSONを拒否 %s',text=>{expect(()=>parseBackup(text)).toThrow();});
it.each([
  (b:Record<string,unknown>)=>{b.type='other';},(b:Record<string,unknown>)=>{b.formatVersion=2;},(b:Record<string,unknown>)=>{b.dbVersion=4;},(b:Record<string,unknown>)=>{delete b.data;},(b:Record<string,unknown>)=>{b.exportedAt='yesterday';},
])('envelope不正拒否',change=>{const b=makeBackup(fixture(),stamp);change(b as unknown as Record<string,unknown>);expect(()=>validateBackup(b)).toThrow();});
it.each(backupTables)('%s collection型違いを拒否',table=>{const b=makeBackup(fixture(),stamp);(b.data as unknown as Record<string,unknown>)[table]={};expect(()=>validateBackup(b)).toThrow();});
it.each([
  {id:123},{calories:'600'},{protein:null},{fat:Infinity},{carbs:-1},{quantity:NaN},{eatenAt:'2026-02-30T03:00:00Z'},{name:[]},{notes:{}},{recipeSnapshot:[]},{restaurantSnapshot:{}},{chatgptSnapshot:{}},
])('critical meal不正拒否 %o',patch=>{const b=makeBackup(fixture(),stamp);Object.assign(b.data.meals[0],patch);expect(()=>validateBackup(b)).toThrow();});
it('duplicate IDと身体測定同日重複は拒否',()=>{const b=makeBackup(fixture(),stamp);b.data.meals.push({...b.data.meals[0]});expect(()=>validateBackup(b)).toThrow();b.data.meals.pop();b.data.weights.push({...b.data.weights[0],id:'other'});expect(()=>validateBackup(b)).toThrow();});
it('身体測定・設定・セット・レシピ・favoriteの壊れたshapeを拒否',()=>{
  const mutations=[(b:ReturnType<typeof makeBackup>)=>{b.data.weights[0].bodyFatPercent=NaN;},(b:ReturnType<typeof makeBackup>)=>{b.data.settings[0].theme='bad' as 'dark';},(b:ReturnType<typeof makeBackup>)=>{b.data.mealSets[0].items=null as never;},(b:ReturnType<typeof makeBackup>)=>{b.data.recipes[0].ingredients[0].grams=-1;},(b:ReturnType<typeof makeBackup>)=>{delete b.data.favorites[0].mealSnapshot;}];
  for(const mutate of mutations){const b=makeBackup(fixture(),stamp);mutate(b);expect(()=>validateBackup(b)).toThrow();}
});
it('サイズ超過はファイル本文を読む前に拒否',async()=>{let read=false;await expect(readBackupFile({size:backupLimit+1,text:async()=>{read=true;return '{}';}})).rejects.toThrow(/50MiB/);expect(read).toBe(false);});
it('prototypeキー・深い入れ子・危険な出典URLを拒否',()=>{expect(()=>parseBackup('{"__proto__":{}}')).toThrow();const b=makeBackup(fixture(),stamp);b.data.meals[2].restaurantSnapshot!.nutrientProvenance.calories.sourceUrl='javascript:alert(1)';expect(()=>validateBackup(b)).toThrow();let deep:unknown={};for(let i=0;i<66;i++)deep={child:deep};expect(()=>validateBackup(deep)).toThrow();});
it('未知optionalフィールドは消さずsnapshot数値を再計算しない',async()=>{const b=makeBackup(fixture(),stamp);Object.assign(b.data.meals[0],{nutritionLabel:{basis:'1包装',calories:123},legacyOptional:{note:'保存値'}});b.data.meals[1].calories=777;await restoreBackup(b,database);expect((await exportBackup(database,stamp)).data.meals).toEqual([...b.data.meals].sort((a,b)=>a.id.localeCompare(b.id)));});
it('完全復元は既存IDが重複しても置換、余分な現在recordを残さない',async()=>{await seed();await database.meals.add({...manual,id:'extra'});const b=makeBackup(fixture(),stamp);b.data.meals[0].calories=700;await restoreBackup(b,database);expect(await database.meals.get('extra')).toBeUndefined();expect((await database.meals.get('meal'))?.calories).toBe(700);expect(await database.settings.get('user')).toEqual(b.data.settings[0]);});
it('import内に古いpendingがあっても復元しない、完了metadataは保持',async()=>{const b=makeBackup(fixture(),stamp);b.data.settings[0].pendingHealthExport=fixture().settings[0].pendingHealthExport;await restoreBackup(b,database);expect((await database.settings.get('user'))?.pendingHealthExport).toBeUndefined();expect((await database.weights.get('weight'))?.healthExport).toEqual(b.data.weights[0].healthExport);expect(b.data.settings[0].pendingHealthExport).toBeDefined();});
it('別isolated DBへのround tripで全ユーザーデータが等価',async()=>{await seed();const exported=await exportBackup(database,stamp);await restoreBackup(parseBackup(backupText(exported)),other);expect((await exportBackup(other,stamp)).data).toEqual(exported.data);});
it('invalid backupでDB不変',async()=>{await seed();const before=await raw();await expect(restoreBackup({type:'wrong'},database)).rejects.toThrow();expect(await raw()).toEqual(before);});
it('全clearとmeals書込み後の故意の失敗で全6tableをrollback',async()=>{
  await seed();const before=await raw(),b=makeBackup(fixture(),stamp);b.data.meals[0].calories=999;
  let reached=false;const hook=()=>{reached=true;throw new Error('simulated storage failure');};database.settings.hook('creating',hook);
  try{await expect(restoreBackup(b,database)).rejects.toThrow('simulated');}finally{database.settings.hook('creating').unsubscribe(hook);}
  expect(reached).toBe(true);expect(await raw()).toEqual(before);
});
