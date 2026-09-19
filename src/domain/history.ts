import { localDate, shiftDate } from './date';
import { mealLabels, type MealEntry, type MealType } from './types';
import { validLocalDateTime } from './validation';
export const historySources = { manual:'手動', chatgpt:'ChatGPT', database:'食品DB', recipe:'レシピ', set:'セット', restaurant:'外食', other:'その他' } as const;
export type HistorySource = keyof typeof historySources;
export interface SearchFilters { query:string; period:'all'|'7'|'30'|'90'|'custom'; start:string; end:string; mealType:MealType|''; source:HistorySource|'' }
export const emptySearch: SearchFilters = {query:'',period:'all',start:'',end:'',mealType:'',source:''};
export function historySource(meal:MealEntry):HistorySource {
  if(meal.setId || meal.setRunId) return 'set';
  if(meal.restaurantId || meal.restaurantOrderId || meal.restaurantSnapshot) return 'restaurant';
  if(meal.sourceType==='chatgpt') return 'chatgpt';
  if(meal.sourceType==='recipe' || meal.recipeSnapshot) return 'recipe';
  if(meal.sourceType==='database') return 'database';
  if(meal.sourceType==='manual') return 'manual';
  return 'other';
}
// Preserve the existing eatenAt reverse index ordering, including its primary-key tie order.
export function searchHistory(meals:MealEntry[], filters:SearchFilters, today=localDate()) {
  const query=filters.query.trim().toLocaleLowerCase();
  const start=filters.period==='custom'?filters.start:filters.period==='all'?'':shiftDate(today,1-Number(filters.period));
  const end=filters.period==='custom'?filters.end:filters.period==='all'?'':today;
  return meals.filter(meal=>{
    const day=localDate(new Date(meal.eatenAt));
    return (!query || meal.name.toLocaleLowerCase().includes(query) || (meal.restaurant ?? meal.restaurantName ?? '').toLocaleLowerCase().includes(query)) &&
      (!start || day>=start) && (!end || day<=end) && (!filters.mealType || meal.mealType===filters.mealType) && (!filters.source || historySource(meal)===filters.source);
  });
}
export type BatchEdit = {kind:'type';mealType:MealType}|{kind:'date';date:string};
export function editHistoryEntry(entry:MealEntry, edit:BatchEdit):MealEntry {
  if(edit.kind==='type') { if(!Object.hasOwn(mealLabels,edit.mealType)) throw new Error('食事区分を選択してください。'); return {...entry,mealType:edit.mealType}; }
  if(!validLocalDateTime(edit.date,'12:00')) throw new Error('変更先の日付を確認してください。');
  const original=new Date(entry.eatenAt), next=new Date(original);
  const [year,month,day]=edit.date.split('-').map(Number);
  next.setFullYear(year,month-1,day);
  // DST gaps cannot preserve a nonexistent local time; reject instead of silently shifting it.
  if(!Number.isFinite(next.getTime()) || localDate(next)!==edit.date || next.getHours()!==original.getHours() || next.getMinutes()!==original.getMinutes() || next.getSeconds()!==original.getSeconds() || next.getMilliseconds()!==original.getMilliseconds()) throw new Error('この日付では元の時刻を保持できません。別の日付を選んでください。');
  return {...entry,eatenAt:next.toISOString()};
}
export interface DeletedMeals { entries:MealEntry[]; expiresAt:number }
export const undoDuration=15000;
export function canUndo(batch:DeletedMeals, now=Date.now()) {return batch.entries.length>0 && now<batch.expiresAt;}
