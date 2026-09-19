import { db, type MealLogDatabase } from './db';
import { canUndo, editHistoryEntry, undoDuration, type BatchEdit, type DeletedMeals } from '../domain/history';
async function selected(ids:string[], database:MealLogDatabase) {
  const keys=[...new Set(ids)];if(!keys.length) throw new Error('記録を選択してください。');
  const rows=await database.meals.bulkGet(keys);
  if(rows.some(row=>!row)) throw new Error('記録が変更されています。選択し直してください。');
  return rows.map(row=>row!);
}
export async function batchEditMeals(ids:string[], edit:BatchEdit, database:MealLogDatabase=db) {
  await database.transaction('rw',database.meals,async()=>{
    const rows=await selected(ids,database);
    await database.meals.bulkPut(rows.map(row=>editHistoryEntry(row,edit)));
  });
}
export async function deleteMealsWithUndo(ids:string[], database:MealLogDatabase=db, now=Date.now):Promise<DeletedMeals> {
  const entries=await database.transaction('rw',database.meals,async()=>{
    const rows=structuredClone(await selected(ids,database));
    await database.meals.bulkDelete(rows.map(row=>row.id));return rows;
  });
  return {entries,expiresAt:now()+undoDuration};
}
export async function restoreDeletedMeals(batch:DeletedMeals, database:MealLogDatabase=db, now=Date.now) {
  if(!canUndo(batch,now())) throw new Error('元に戻せる時間が過ぎました。');
  await database.transaction('rw',database.meals,async()=>{
    if(!canUndo(batch,now())) throw new Error('元に戻せる時間が過ぎました。');
    const existing=await database.meals.bulkGet(batch.entries.map(row=>row.id));
    if(existing.some(Boolean)) throw new Error('一部の記録が既に存在するため元に戻せませんでした。');
    await database.meals.bulkAdd(structuredClone(batch.entries));
  });
}
