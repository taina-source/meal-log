import { useEffect, useRef, useState } from 'react';
import { deleteMealsWithUndo, restoreDeletedMeals } from '../data/history';
import { type DeletedMeals } from '../domain/history';
import { storageError } from '../data/repository';
export function useMealUndo(notify:(message:string)=>void) {
  const [batch,setBatch]=useState<DeletedMeals|null>(null), [busy,setBusy]=useState(false);
  const lock=useRef(false);
  useEffect(()=>{if(!batch)return;const timer=window.setTimeout(()=>setBatch(current=>current===batch?null:current),Math.max(0,batch.expiresAt-Date.now()));return()=>clearTimeout(timer);},[batch]);
  async function remove(ids:string[]) {
    if(lock.current)throw new Error('処理中です。');lock.current=true;setBusy(true);
    try { const deleted=await deleteMealsWithUndo(ids);setBatch(deleted); }
    finally {lock.current=false;setBusy(false);}
  }
  async function undo() {
    if(!batch || lock.current)return;lock.current=true;setBusy(true);
    try {await restoreDeletedMeals(batch);setBatch(null);notify('削除した食事を元に戻しました');}
    catch(error){setBatch(null);notify(storageError(error));}
    finally{lock.current=false;setBusy(false);}
  }
  return {batch,busy,remove,undo};
}
