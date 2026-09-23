import { Fragment, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { batchEditMeals } from '../data/history';
import { storageError } from '../data/repository';
import { emptySearch, historySource, historySources, searchHistory, type SearchFilters, type BatchEdit } from '../domain/history';
import { mealLabels, type MealEntry, type MealType, type UserSettings } from '../domain/types';
import { formatDate, localDate, localTime, relativeDate } from '../domain/date';
import { formatNumber, sumNutrients } from '../domain/nutrition';
import { validLocalDateTime } from '../domain/validation';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { FormError } from '../components/Fields';
import { HistoryCalendar } from '../components/HistoryCalendar';
import '../styles/history.css';
export interface HistoryFilter { date: string; type: MealType }
export function History({ settings, filter, onClearFilter, onSelect, onAdd, onDelete, notify }: { settings: UserSettings; filter: HistoryFilter | null; onClearFilter: () => void; onSelect: (entry: MealEntry) => void; onAdd: () => void; onDelete:(ids:string[])=>Promise<void>; notify:(message:string)=>void }) {
  // Dexie reverse cursor orders ties by descending primary key, as in the original History.
  const meals = useLiveQuery(() => db.meals.orderBy('eatenAt').reverse().toArray(), []);
  const [search,setSearch]=useState<SearchFilters>({...emptySearch});
  const [view,setView]=useState<'list'|'calendar'>('list');
  const [selecting,setSelecting]=useState(false), [selected,setSelected]=useState<string[]>([]);
  const [type,setType]=useState<MealType>('dinner'), [date,setDate]=useState(localDate());
  const [confirmation,setConfirmation]=useState<{ids:string[];days:number;edit:BatchEdit|'delete'}|null>(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  function changeSearch(change:Partial<SearchFilters>) {setSearch(current=>({...current,...change}));setSelected([]);setConfirmation(null);onClearFilter();}
  const visible = searchHistory(filter ? (meals??[]).filter(meal=>localDate(new Date(meal.eatenAt))===filter.date && meal.mealType===filter.type) : meals??[],search);
  // Never operate on a row no longer visible, even if live data changed outside this screen.
  const selectedIds=new Set(selected);
  const selectedRows=visible.filter(row=>selectedIds.has(row.id));
  function confirm(edit:BatchEdit|'delete') {
    if(!selectedRows.length)return;
    setError('');setConfirmation({ids:selectedRows.map(row=>row.id),days:new Set(selectedRows.map(row=>localDate(new Date(row.eatenAt)))).size,edit});
  }
  async function execute() {
    if(!confirmation || busy)return;setBusy(true);setError('');
    try {
      if(confirmation.edit==='delete')await onDelete(confirmation.ids);
      else {await batchEditMeals(confirmation.ids,confirmation.edit);notify(`${confirmation.ids.length}件を変更しました`);}
      setSelected([]);setConfirmation(null);
    }catch(error){setError(storageError(error));}finally{setBusy(false);}
  }
  const grouped = new Map<string, MealEntry[]>();
  visible.forEach(meal => { const day = localDate(new Date(meal.eatenAt)); const group=grouped.get(day)??[];group.push(meal);grouped.set(day,group); });
  if(meals===undefined)return <p className="loading">記録を読み込み中…</p>;
  return <><div className="page-heading"><p className="eyebrow">YOUR JOURNAL</p><h1>食事の履歴</h1><p className="muted">日々の記録を、少しずつ。</p></div>
    <div className="segmented history-view" role="group" aria-label="履歴の表示方法">{([['list','一覧'],['calendar','カレンダー']] as const).map(([value,label])=><button key={value} aria-pressed={view===value} className={view===value?'selected':''} onClick={()=>{setView(value);setSelected([]);setSelecting(false);setConfirmation(null);}}>{label}</button>)}</div>
    {view==='calendar' ? <HistoryCalendar meals={meals} initialDate={filter?.date || (search.period==='custom'?search.start:undefined)} onDay={day=>{changeSearch({...emptySearch,period:'custom',start:day,end:day});setSelecting(false);setView('list');}}/> : <>
    <section className="card form-stack history-tools" aria-label="履歴検索">
      <label className="field"><span>全履歴を検索</span><input type="search" placeholder="料理名・店名" value={search.query} onChange={e=>changeSearch({query:e.target.value})} /></label>
      <details><summary>絞り込み</summary><div className="form-stack">
        <label className="field"><span>期間</span><select value={search.period} onChange={e=>changeSearch({period:e.target.value as SearchFilters['period']})}>{[['all','全期間'],['7','過去7日'],['30','過去30日'],['90','過去90日'],['custom','任意期間']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
        {search.period==='custom' && <><label className="field"><span>開始日</span><input type="date" value={search.start} onChange={e=>changeSearch({start:e.target.value})}/></label><label className="field"><span>終了日</span><input type="date" value={search.end} onChange={e=>changeSearch({end:e.target.value})}/></label>{search.start && search.end && search.start>search.end && <p className="help">開始日と終了日を確認してください。</p>}</>}
        <label className="field"><span>食事区分で絞り込み</span><select value={search.mealType} onChange={e=>changeSearch({mealType:e.target.value as SearchFilters['mealType']})}><option value="">すべて</option>{Object.entries(mealLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
        <label className="field"><span>入力元</span><select value={search.source} onChange={e=>changeSearch({source:e.target.value as SearchFilters['source']})}><option value="">すべて</option>{Object.entries(historySources).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
      </div></details>
      <div className="section-heading"><p>{visible.length}件</p><button className="button secondary" onClick={()=>{setSelecting(!selecting);setSelected([]);}}>{selecting?'選択モード終了':'選択'}</button></div>
      {selecting && <><p role="status">{selectedRows.length}件選択中</p><div className="history-actions"><button className="button secondary" onClick={()=>setSelected(visible.map(row=>row.id))}>表示中をすべて選択</button><button className="button secondary" onClick={()=>setSelected([])}>選択解除</button></div>
        <label className="field"><span>変更先の食事区分</span><select value={type} onChange={e=>setType(e.target.value as MealType)}>{Object.entries(mealLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><button className="button secondary" disabled={!selectedRows.length} onClick={()=>confirm({kind:'type',mealType:type})}>食事区分を一括変更</button>
        <label className="field"><span>変更先の日付</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="button secondary" disabled={!selectedRows.length || !validLocalDateTime(date,'12:00')} onClick={()=>confirm({kind:'date',date})}>日付を一括変更</button>
        <button className="button danger-subtle" disabled={!selectedRows.length} onClick={()=>confirm('delete')}>選択した記録を削除</button></>}
    </section>
    {filter && <div className="filter-note"><span>{formatDate(filter.date)}・{mealLabels[filter.type]}</span><button onClick={()=>{setSelected([]);onClearFilter();}}>すべて表示</button></div>}
    {visible.length===0 ? <div className="card empty-state"><Icon name="history" size={36}/><h2>{search.period==='custom' && search.start===search.end && search.start?'この日の食事記録はありません':meals.length?'条件に一致する記録がありません':'まだ食事の記録がありません'}</h2><button className="button primary" onClick={onAdd}>食事を追加</button></div> : [...grouped].map(([day,entries])=><section className="history-group" key={day}><div className="section-heading"><h2>{relativeDate(day)}</h2><span>{formatNumber(sumNutrients(entries).calories)} kcal</span></div><div className="card">{entries.map((entry,index)=><Fragment key={entry.id}>
      {entry.chatgptImportId && entries.findIndex(e=>e.chatgptImportId===entry.chatgptImportId)===index && <div className="restaurant-order-heading">{entry.chatgptSnapshot?.inputType==='photo'?'ChatGPT写真取り込み':'ChatGPT取り込み'} · {formatNumber(sumNutrients(entries.filter(e=>e.chatgptImportId===entry.chatgptImportId)).calories)} kcal</div>}
      {entry.restaurantOrderId && entries.findIndex(e=>e.restaurantOrderId===entry.restaurantOrderId)===index && <div className="restaurant-order-heading">{[...new Set(entries.filter(e=>e.restaurantOrderId===entry.restaurantOrderId).map(e=>e.restaurant))].join('・')} · 同じ外食 {formatNumber(sumNutrients(entries.filter(e=>e.restaurantOrderId===entry.restaurantOrderId)).calories)} kcal</div>}
      {selecting && <label className="history-check"><input type="checkbox" aria-label={`${entry.name}を選択`} checked={selectedIds.has(entry.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,entry.id]:current.filter(id=>id!==entry.id))}/>{entry.name}を選択</label>}
      <button className="history-row" onClick={()=>onSelect(entry)}><span className={`meal-icon ${entry.mealType}`}><Icon name={entry.mealType}/></span><span className="history-copy"><span className="history-meta">{mealLabels[entry.mealType]}<span>{localTime(new Date(entry.eatenAt))}</span></span><small>{day} · {historySources[historySource(entry)]}</small>{entry.restaurant && <span className="muted">{entry.restaurant}</span>}<strong>{entry.name}</strong><span className="history-calories">{formatNumber(entry.calories)} <small>kcal</small></span><span className="history-pfc">P {formatNumber(entry.protein,settings.showPfcDecimals)} / F {formatNumber(entry.fat,settings.showPfcDecimals)} / C {formatNumber(entry.carbs,settings.showPfcDecimals)} g</span></span><Icon name="chevron-right" size={18}/></button>
    </Fragment>)}</div></section>)}
    </>}
    {confirmation && <Modal title="一括操作の確認" onClose={()=>{if(!busy){setConfirmation(null);setError('');}}}><div className="form-stack">
      <p>{confirmation.ids.length}件{confirmation.edit==='delete'?'の食事記録を削除します':confirmation.edit.kind==='type'?`の食事区分を「${mealLabels[confirmation.edit.mealType]}」に変更します`:`の日付を${confirmation.edit.date.replaceAll('-','/')}に変更します。元の時刻は保持されます。`}</p>
      {confirmation.edit==='delete' && <p>{confirmation.days}日分 · 削除後約15秒は元に戻せます。</p>}<FormError message={error}/><button className="button secondary" disabled={busy} onClick={()=>setConfirmation(null)}>キャンセル</button><button className={`button ${confirmation.edit==='delete'?'danger':'primary'}`} disabled={busy} onClick={execute}>{busy?'処理中…':confirmation.edit==='delete'?'削除する':'変更する'}</button>
    </div></Modal>}
  </>;
}
