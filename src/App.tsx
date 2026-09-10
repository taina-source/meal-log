import { consumeImportFragment, type ImportReceipt } from './domain/chatgpt';
import { ChatgptImport } from './pages/add/ChatgptImport';
import { createId } from './data/id';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from './data/repository';
import { localDate } from './domain/date';
import { inferMealType } from './domain/nutrition';
import type { MealEntry, MealType, UserSettings } from './domain/types';
import { Icon } from './components/Icon';
import { Navigation, type Page } from './components/Navigation';
import { Modal } from './components/Modal';
import { WeightForm } from './components/WeightForm';
import { PfcDecimalsContext } from './components/CatalogParts';
import { PwaStatus } from './components/PwaStatus';
import { Home } from './pages/Home';
import { History, type HistoryFilter } from './pages/History';
import { MealForm } from './pages/MealForm';
import { AddMealFlow } from './pages/add/AddMealFlow';
import { CopyMeals } from './pages/CopyMeals';
import { MealDetail } from './pages/MealDetail';
import { Settings } from './pages/Settings';
import { Analysis } from './pages/Analysis';
type Overlay = { kind: 'chatgpt'; receipt: ImportReceipt; key: string } | { kind: 'meal'; type: MealType; date: string; entry?: MealEntry } | { kind: 'detail'; entry: MealEntry } | { kind: 'weight'; date: string; weight?: number } | { kind: 'copy'; date: string } | null;
function useTheme(theme: UserSettings['theme'] | undefined) {
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || ((theme === 'system' || !theme) && system.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131b17' : '#f5f7f4');
    };
    apply(); system.addEventListener('change', apply);
    return () => system.removeEventListener('change', apply);
  }, [theme]);
}
export default function App({ initialImport = null }: { initialImport?: ImportReceipt | null }) {
  const settings = useLiveQuery(getSettings, []);
  const [page, setPage] = useState<Page>('home');
  const [date, setDate] = useState(localDate());
  const [today, setToday] = useState(localDate());
  const [overlay, setOverlay] = useState<Overlay>(() => initialImport ? { kind: 'chatgpt', receipt: initialImport, key: 'initial' } : null);
  const [filter, setFilter] = useState<HistoryFilter | null>(null);
  const [toast, setToast] = useState('');
  useTheme(settings?.theme);
  useEffect(() => {
    const receive = () => { const receipt = consumeImportFragment(window); if (receipt) setOverlay({ kind: 'chatgpt', receipt, key: createId() }); };
    window.addEventListener('hashchange', receive); receive();
    return () => window.removeEventListener('hashchange', receive);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const refresh = () => { const next = localDate(); if (next !== today) { setDate(current => current === today ? next : current); setToday(next); } };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [today]);
  function navigate(next: Page) { setPage(next); setFilter(null); window.scrollTo({ top: 0 }); }
  function add(type?: MealType, targetDate?: string) { setOverlay({ kind: 'meal', type: type ?? inferMealType(), date: targetDate ?? (page === 'home' ? date : localDate()) }); }
  function saved(savedDate: string) { setOverlay(null); setDate(savedDate); setPage('home'); setToast('食事を保存しました'); window.scrollTo({ top: 0 }); }
  return <div className="app-shell"><header className="app-header"><a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('home'); }} aria-label="Meal Log ホーム"><span className="brand-mark"><Icon name="leaf" size={21} /></span><span>Meal Log<span className="brand-dot">.</span></span></a><span className="header-caption">毎日を、ちょうどよく。</span></header><main id="main-content">{!settings ? <p className="loading">記録を読み込み中…</p> : <>{page === 'home' && <Home date={date} setDate={setDate} settings={settings} onAdd={add} onHistory={type => { setFilter({ date, type }); setPage('history'); window.scrollTo({ top: 0 }); }} onWeight={weight => setOverlay({ kind: 'weight', date, weight })} onCopy={() => setOverlay({ kind: 'copy', date })} onComingSoon={() => setToast('この機能は今後追加予定です')} />}{page === 'history' && <History settings={settings} filter={filter} onClearFilter={() => setFilter(null)} onSelect={entry => setOverlay({ kind: 'detail', entry })} onAdd={() => add(filter?.type, filter?.date)} />}{page === 'analysis' && <Analysis settings={settings} />}{page === 'settings' && <Settings settings={settings} notify={setToast} />}</>}</main><Navigation page={page} onNavigate={navigate} onAdd={() => add()} /><PwaStatus />{toast && <div className="toast" role="status"><Icon name="check" size={18} />{toast}</div>}{overlay && settings && <Modal key={overlay.kind + (overlay.kind === 'chatgpt' ? overlay.key : '') + ('entry' in overlay ? overlay.entry?.id ?? '' : '')} title={overlay.kind === 'chatgpt' ? 'ChatGPT取り込み' : overlay.kind === 'meal' ? overlay.entry ? '食事を編集' : '食事を追加' : overlay.kind === 'detail' ? '食事の詳細' : overlay.kind === 'copy' ? '前日の食事をコピー' : '体重を記録'} onClose={() => setOverlay(null)}>{overlay.kind === 'meal' && (overlay.entry ? <MealForm date={overlay.date} initialType={overlay.type} entry={overlay.entry} onSaved={saved} /> : <PfcDecimalsContext.Provider value={settings.showPfcDecimals}><AddMealFlow date={overlay.date} initialType={overlay.type} onSaved={saved} /></PfcDecimalsContext.Provider>)}{overlay.kind === 'chatgpt' && <PfcDecimalsContext.Provider value={settings.showPfcDecimals}><ChatgptImport initialReceipt={overlay.receipt} onSaved={saved} onCancel={() => setOverlay(null)} /></PfcDecimalsContext.Provider>}{overlay.kind === 'copy' && <CopyMeals date={overlay.date} onDone={message => { setOverlay(null); setToast(message); }} />}{overlay.kind === 'detail' && <MealDetail entry={overlay.entry} settings={settings} onEdit={() => setOverlay({ kind: 'meal', date: localDate(new Date(overlay.entry.eatenAt)), type: overlay.entry.mealType, entry: overlay.entry })} onDeleted={() => { setOverlay(null); setToast('食事を削除しました'); }} />}{overlay.kind === 'weight' && <WeightForm date={overlay.date} current={overlay.weight} onSaved={() => { setOverlay(null); setToast('体重を保存しました'); }} />}</Modal>}</div>;
}
