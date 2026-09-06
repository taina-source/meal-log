import { useEffect, useState, type FormEvent } from 'react';
import type { UserSettings } from '../domain/types';
import { saveSettings, storageError } from '../data/repository';
import { validateSettings } from '../domain/validation';
import { NumberField, FormError } from '../components/Fields';
export function Settings({ settings, notify }: { settings: UserSettings; notify: (message: string) => void }) {
  const [calories, setCalories] = useState(String(settings.calorieTarget));
  const [protein, setProtein] = useState(String(settings.proteinTarget));
  const [fat, setFat] = useState(String(settings.fatTarget));
  const [carbs, setCarbs] = useState(String(settings.carbsTarget));
  const [weight, setWeight] = useState(settings.targetWeight?.toString() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCalories(String(settings.calorieTarget)); setProtein(String(settings.proteinTarget)); setFat(String(settings.fatTarget)); setCarbs(String(settings.carbsTarget)); setWeight(settings.targetWeight?.toString() ?? ''); }, [settings.calorieTarget, settings.proteinTarget, settings.fatTarget, settings.carbsTarget, settings.targetWeight]);
  async function persist(next: UserSettings, message: string) {
    if (busy) return;
    setBusy(true); setError('');
    try { await saveSettings(next); notify(message); } catch (error) { setError(storageError(error)); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if ([calories, protein, fat, carbs].some(value => !value.trim())) { setError('カロリーとPFCの目標を入力してください。PFCは0gも指定できます。'); return; }
    const next = { ...settings, calorieTarget: Number(calories), proteinTarget: Number(protein), fatTarget: Number(fat), carbsTarget: Number(carbs), targetWeight: weight.trim() ? Number(weight) : null };
    const validation = validateSettings(next);
    if (validation) { setError(validation); return; }
    await persist(next, '目標を保存しました');
  }
  return <><div className="page-heading"><p className="eyebrow">MAKE IT YOURS</p><h1>設定</h1><p className="muted">あなたのペースに合わせて。</p></div><form noValidate className="card settings-card form-stack" onSubmit={submit}><h2>1日の目標</h2><NumberField label="カロリー" unit="kcal" value={calories} onChange={setCalories} required min={1} max={20000} /><div className="form-pfc"><NumberField label="P たんぱく質" unit="g" value={protein} onChange={setProtein} /><NumberField label="F 脂質" unit="g" value={fat} onChange={setFat} /><NumberField label="C 炭水化物" unit="g" value={carbs} onChange={setCarbs} /></div><NumberField label="目標体重（任意）" unit="kg" value={weight} onChange={setWeight} min={1} max={500} /><button className="button primary" disabled={busy}>{busy ? '保存中…' : '目標を保存'}</button></form><FormError message={error} /><section className="card settings-card"><h2>表示</h2><fieldset className="segment-field theme-field"><legend>テーマ</legend><div className="segmented">{(['system', 'light', 'dark'] as const).map((theme, index) => <button key={theme} aria-pressed={settings.theme === theme} className={settings.theme === theme ? 'selected' : ''} disabled={busy} onClick={() => persist({ ...settings, theme }, 'テーマを変更しました')}>{['システム', 'ライト', 'ダーク'][index]}</button>)}</div></fieldset><div className="switch-row"><div><label htmlFor="decimals">PFCの小数表示</label><p className="help">OFFでも元の記録値は保持されます</p></div><button id="decimals" className="switch" role="switch" aria-checked={settings.showPfcDecimals} aria-label="PFCの小数表示" disabled={busy} onClick={() => persist({ ...settings, showPfcDecimals: !settings.showPfcDecimals }, '表示設定を変更しました')}><span /><b>{settings.showPfcDecimals ? 'ON' : 'OFF'}</b></button></div></section><section className="card settings-card device-info"><h2>このアプリについて</h2><p>食事・体重・設定は、この端末の中に保存されます。ログインや通信先のサーバーはありません。</p><p>ホーム画面への追加：Safariの共有メニューから「ホーム画面に追加」を選んでください。</p><p>SafariのWebサイトデータを消去すると記録も削除されます。別の端末・別のURLへは自動で引き継がれません。</p><span className="version">MEAL LOG · VERSION 1.0</span></section></>;
}
