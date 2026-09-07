import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { FavoriteKind } from '../domain/catalog';
import type { Nutrients } from '../domain/types';
import { formatNumber } from '../domain/nutrition';
import { db } from '../data/db';
import { favoriteId, removeFavorite, saveFavorite } from '../data/catalogRepository';
import { storageError } from '../data/repository';
import { FormError } from './Fields';
export const PfcDecimalsContext = createContext(true);
export function usePfcDecimals() { return useContext(PfcDecimalsContext); }
export function NutrientSummary({ value, label = '今回', decimals }: { value: Nutrients; label?: string; decimals?: boolean }) {
  const preference = usePfcDecimals();
  const show = decimals ?? preference;
  return <section className="nutrient-summary" aria-label={label}><h3>{label}</h3><p><strong>{formatNumber(value.calories, true)}</strong> kcal</p><div>P {formatNumber(value.protein, show)}g / F {formatNumber(value.fat, show)}g / C {formatNumber(value.carbs, show)}g</div></section>;
}
export function BackButton({ onClick, label = '戻る' }: { onClick: () => void; label?: string }) { return <button className="back-button" type="button" onClick={onClick}>〈 {label}</button>; }
export function useSheetTop(screen: string) {
  useEffect(() => { document.querySelector('dialog')?.scrollTo({ top: 0 }); }, [screen]);
}
export function ActionButton({ action, children, disabled = false, className = 'button primary' }: { action: () => Promise<unknown> | unknown; children: ReactNode; disabled?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="action-wrap"><button type="button" className={className} disabled={disabled || busy} onClick={async () => { if (busy) return; setBusy(true); setError(''); try { await action(); } catch (error) { setError(storageError(error)); } finally { setBusy(false); } }}>{busy ? '処理中…' : children}</button><FormError message={error} /></div>;
}
export function FavoriteButton({ kind, sourceId, quantity }: { kind: FavoriteKind; sourceId: string; quantity: number }) {
  const id = favoriteId(kind, sourceId, quantity);
  const favorite = useLiveQuery(() => db.favorites.get(id), [id]);
  return <ActionButton className="button secondary" disabled={!Number.isFinite(quantity) || quantity <= 0} action={() => favorite ? removeFavorite(id) : saveFavorite(kind, sourceId, quantity)}>{favorite ? '★ お気に入りを解除' : '☆ この量でお気に入り'}</ActionButton>;
}
export function Notes({ notes }: { notes?: string[] }) { return <>{notes?.map(note => <p key={note} className="catalog-note">{note}</p>)}</>; }
