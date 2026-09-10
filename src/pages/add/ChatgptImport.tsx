import { useEffect, useRef, useState, type FormEvent } from 'react';
import { chatgptModified, chatgptTotals, chatgptWarnings, nutrientKeys, nutrientLabels, pasteLimit, readChatgptJson, type ChatgptItem, type ImportReceipt } from '../../domain/chatgpt';
import { mealLabels, mealTypes, type MealType, type Nutrients } from '../../domain/types';
import { localDate, localTime } from '../../domain/date';
import { inferMealType } from '../../domain/nutrition';
import { registerChatgpt } from '../../data/chatgpt';
import { storageError } from '../../data/repository';
import { FormError } from '../../components/Fields';
import { NutrientSummary } from '../../components/CatalogParts';
import { ChatgptSource } from '../../components/ChatgptSource';

export function ChatgptImport({ initialReceipt, context, onSaved, onCancel }: { initialReceipt?: ImportReceipt; context?: { date: string; time: string; mealType: MealType }; onSaved: (date: string) => void; onCancel: () => void }) {
  const [receipt, setReceipt] = useState<ImportReceipt | undefined>(initialReceipt);
  const [items, setItems] = useState<ChatgptItem[]>(() => structuredClone(initialReceipt?.payload?.items ?? []));
  const [text, setText] = useState(''), [error, setError] = useState(initialReceipt?.error ?? '');
  const [date, setDate] = useState(context?.date ?? localDate()), [time, setTime] = useState(context?.time ?? localTime()), [mealType, setMealType] = useState(context?.mealType ?? inferMealType());
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false);
  const saving = useRef(false), mounted = useRef(true);
  // Clipboard results are applied only if the same paste screen is still active.
  const clipboardRequest = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clipboardRequest.current++; }; }, []);
  function read(value: string) {
    clipboardRequest.current++;
    const result = readChatgptJson(value); setReceipt(result); setError(result.error ?? '');
    setItems(structuredClone(result.payload?.items ?? []));
    if (result.payload) { setText(''); document.querySelector('dialog')?.scrollTo({ top: 0 }); }
  }
  async function clipboard() {
    const request = ++clipboardRequest.current; setReading(true);
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported');
      const value = await navigator.clipboard.readText();
      if (mounted.current && request === clipboardRequest.current) read(value);
    } catch { if (mounted.current && request === clipboardRequest.current) setError('貼り付け欄を長押ししてペーストしてください。'); }
    finally { setReading(false); }
  }
  function update(index: number, patch: Partial<ChatgptItem>) { setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item)); setError(''); }
  let totals: Nutrients | undefined, invalid = '';
  if (items.length) { try { totals = chatgptTotals(items); } catch (e) { invalid = storageError(e); } }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (saving.current || !receipt) return;
    saving.current = true; setBusy(true);
    try { await registerChatgpt(receipt, items, { date, time, mealType }); onSaved(date); }
    catch (e) { setError(storageError(e)); }
    finally { saving.current = false; setBusy(false); }
  }
  const cancel = () => { mounted.current = false; clipboardRequest.current++; onCancel(); };
  return <div className="form-stack chatgpt-import"><h3>ChatGPTから取り込み</h3><p className="help">内容を確認・修正してから保存します。登録するまで端末の記録は変わりません。</p>{!receipt?.payload ? <>
    <button className="button secondary" disabled={reading} onClick={clipboard}>{reading ? '読み込み中…' : 'クリップボードから読み込む'}</button>
    <label className="field"><span>JSONを貼り付け</span><textarea rows={9} value={text} maxLength={pasteLimit + 1} onChange={e => { clipboardRequest.current++; setText(e.target.value); }} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder='{"schemaVersion":1,"type":"meal-log-chatgpt","items":[…]}' /></label>
    <p className="help">貼り付け欄を長押ししてペーストできます。最大20商品・128KiB。</p><FormError message={error} /><button className="button primary" onClick={() => read(text)}>読み込む</button>
  </> : <form className="form-stack" noValidate onSubmit={submit}>
    <p className="catalog-note">栄養値は「1単位あたり」です。数量を掛けて合計します。合計値を受け取った場合は数量を1にしてください。</p>
    {items.map((item, index) => <fieldset className="chatgpt-item form-stack" key={index} disabled={busy}><legend>商品{index + 1}</legend>
      <label className="field"><span>商品名</span><input value={item.name} maxLength={100} onChange={e => update(index, { name: e.target.value })} required /></label>
      <label className="field"><span>店名</span><input value={item.restaurant} maxLength={100} onChange={e => update(index, { restaurant: e.target.value })} /></label>
      <div className="two-columns"><label className="field"><span>数量</span><input type="number" inputMode="decimal" step="any" value={Number.isNaN(item.quantity) ? '' : item.quantity} onChange={e => update(index, { quantity: e.target.value === '' ? NaN : Number(e.target.value) })} /></label><label className="field"><span>単位</span><input value={item.unit} maxLength={30} onChange={e => update(index, { unit: e.target.value })} /></label></div>
      <h4>1単位あたりの栄養値（編集可）</h4><div className="two-columns">{nutrientKeys.map(key => <label className="field" key={key}><span>{nutrientLabels[key]}（{key === 'calories' ? 'kcal' : 'g'}）</span><input type="number" inputMode="decimal" step="any" min="0" value={item[key] ?? ''} placeholder="不明・入力が必要" onChange={e => update(index, { [key]: e.target.value === '' ? null : Number(e.target.value) })} /></label>)}</div>
      <ChatgptSource item={item} />{chatgptModified(receipt.payload!.items[index], item) && <p className="help">ユーザー修正あり（元の値も保存します）</p>}{chatgptWarnings(item).map(warning => <p className="catalog-note" key={warning}>{warning}</p>)}
    </fieldset>)}
    {totals ? <NutrientSummary value={totals} label="今回の合計（数量を反映）" /> : <FormError message={invalid} />}
    <fieldset className="segment-field" disabled={busy}><legend>食事区分</legend><div className="segmented">{mealTypes.map(type => <button type="button" key={type} aria-pressed={mealType === type} className={mealType === type ? 'selected' : ''} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}</div></fieldset>
    <div className="two-columns"><label className="field"><span>登録日</span><input type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={e => setDate(e.target.value)} /></label><label className="field"><span>登録時刻</span><input type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div>
    <FormError message={error} /><button className="button primary" disabled={busy || !!invalid}>{busy ? '保存中…' : '登録する'}</button>
    <button type="button" className="button secondary" disabled={busy} onClick={() => { setReceipt(undefined); setItems([]); setError(''); }}>JSONを貼り直す</button>
  </form>}<button className="button secondary" disabled={busy} onClick={cancel}>キャンセル</button></div>;
}
