import { useSheetTop } from '../../components/CatalogParts';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Food, MealSet, MealSetItem } from '../../domain/catalog';
import { db } from '../../data/db';
import { createId } from '../../data/id';
import { saveSet } from '../../data/catalogRepository';
import { foodItem, positive, scaleNutrients, setTotal } from '../../domain/foods';
import { formatNumber } from '../../domain/nutrition';
import { ActionButton, BackButton, FavoriteButton, NutrientSummary } from '../../components/CatalogParts';
import { NumberField } from '../../components/Fields';
import { FoodPicker } from './FoodPicker';
import { RecipeLibrary } from './RecipeLibrary';
export function SetLibrary({ foods, onChoose, initialSet }: { foods: Food[]; onChoose: (set: MealSet) => unknown | Promise<unknown>; initialSet?: MealSet }) {
  const sets = useLiveQuery(() => db.mealSets.orderBy('updatedAt').reverse().toArray(), []) ?? [];
  const [selected, setSelected] = useState(initialSet), [editing, setEditing] = useState(false);
  useSheetTop(String(editing) + (selected?.id ?? 'list'));
  if (editing) return <SetEditor foods={foods} original={selected} onCancel={() => setEditing(false)} onDone={set => { setSelected(set); setEditing(false); }} />;
  if (selected) return <div className="form-stack"><BackButton label="セット一覧へ" onClick={() => setSelected(undefined)} /><h3>{selected.name}</h3><div className="catalog-list">{selected.items.map(item => <div className="catalog-row" key={item.id}><strong>{item.name}</strong><span>{item.unit === 'g' ? `${item.quantity}g` : `レシピ全体の${formatNumber(item.quantity * 100, true)}%`} · {formatNumber(item.nutrients.calories)} kcal</span></div>)}</div><NutrientSummary label="セット合計" value={setTotal(selected.items)} /><p className="help">構成する{selected.items.length}件をまとめて登録します。登録前に下のボタンで確定してください。</p><FavoriteButton kind="set" sourceId={selected.id} quantity={1} /><ActionButton action={() => onChoose(selected)}>このセットをまとめて登録</ActionButton><button className="button secondary" onClick={() => setEditing(true)}>セットを編集</button></div>;
  return <div className="form-stack"><h3>いつものセット</h3><p className="help">食品やレシピを、よく食べる組み合わせで。</p><button className="button primary" onClick={() => { setSelected(undefined); setEditing(true); }}>＋ 新しいセットを作る</button><div className="catalog-list">{sets.map(set => <button key={set.id} className="catalog-row" onClick={() => setSelected(set)}><strong>{set.name}</strong><span>{set.items.length}品 · {formatNumber(set.total.calories)} kcal</span></button>)}</div>{!sets.length && <p className="help">保存したセットはまだありません。</p>}</div>;
}
function SetEditor({ foods, original, onDone, onCancel }: { foods: Food[]; original?: MealSet; onDone: (set: MealSet) => void; onCancel: () => void }) {
  const [name, setName] = useState(original?.name ?? '');
  const [items, setItems] = useState<MealSetItem[]>(() => structuredClone(original?.items ?? []));
  const [picker, setPicker] = useState<'food' | 'recipe' | null>(null);
  useSheetTop(picker ?? 'editor');
  const invalidQuantity = items.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 10000);
  const add = (item: MealSetItem) => { setItems(current => [...current, { ...item, id: createId() }]); setPicker(null); };
  if (picker) return <div className="form-stack"><BackButton label="セット編集へ" onClick={() => setPicker(null)} />{picker === 'food' ? <FoodPicker foods={foods} actionLabel="セットに追加" onChoose={(food, grams) => add(foodItem(food, grams, createId()))} /> : <RecipeLibrary foods={foods} actionLabel="セットに追加" onChoose={add} />}</div>;
  return <div className="form-stack"><BackButton onClick={onCancel} /><h3>{original ? 'セットを編集' : '新しいセット'}</h3><label className="field"><span>セット名</span><input maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="例：いつもの朝食" /></label>{items.map((item, index) => <SetItemEditor key={item.id} item={item} index={index} onChange={next => setItems(current => current.map(value => value.id === item.id ? next : value))} onRemove={() => setItems(current => current.filter(value => value.id !== item.id))} />)}{invalidQuantity && <p className="form-error" role="alert">各構成の量を0より大きく10000以下で入力してください。</p>}<div className="two-columns"><button className="button secondary" disabled={invalidQuantity} onClick={() => setPicker('food')}>＋ 食品</button><button className="button secondary" disabled={invalidQuantity} onClick={() => setPicker('recipe')}>＋ レシピ</button></div><NutrientSummary label="セット合計" value={setTotal(items)} /><p className="help">セットは保存時の量と栄養値を保持します。元のレシピを更新しても変わりません。更新した内容を使う場合は構成要素を追加し直してください。</p><ActionButton action={async () => onDone(await saveSet(name, items, original?.id))}>セットを保存</ActionButton></div>;
}
function SetItemEditor({ item, index, onChange, onRemove }: { item: MealSetItem; index: number; onChange: (item: MealSetItem) => void; onRemove: () => void }) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [perUnit] = useState(() => scaleNutrients(item.nutrients, 1 / positive(item.quantity, '量')));
  return <div className="ingredient-card"><strong>{item.name}</strong><NumberField label={`構成${index + 1}の${item.unit === 'g' ? '重量' : '全体に対する割合'}`} unit={item.unit === 'g' ? 'g' : '倍'} value={quantity} onChange={value => { setQuantity(value); const number = Number(value); onChange({ ...item, quantity: number, nutrients: scaleNutrients(perUnit, Number.isFinite(number) && number > 0 ? number : 0) }); }} max={10000} /><button className="button danger-subtle" onClick={onRemove}>削除</button><p className="help">{formatNumber(item.nutrients.calories)} kcal</p></div>;
}
