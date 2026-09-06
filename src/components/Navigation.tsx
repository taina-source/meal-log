import { Icon } from './Icon';
export type Page = 'home' | 'history' | 'analysis' | 'settings';
export function Navigation({ page, onNavigate, onAdd }: { page: Page; onNavigate: (page: Page) => void; onAdd: () => void }) {
  const item = (target: Page, label: string) => <button className={`nav-item ${page === target ? 'active' : ''}`} aria-current={page === target ? 'page' : undefined} onClick={() => onNavigate(target)}><Icon name={target} /><span>{label}</span></button>;
  return <nav className="bottom-nav" aria-label="メインナビゲーション">{item('home', 'ホーム')}{item('history', '履歴')}<button className="nav-add" aria-label="食事を追加" onClick={onAdd}><Icon name="plus" size={30} /></button>{item('analysis', '分析')}{item('settings', '設定')}</nav>;
}
