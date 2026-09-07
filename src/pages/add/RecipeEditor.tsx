import { useSheetTop } from '../../components/CatalogParts';
import { useState } from 'react';
import type { Food, Recipe } from '../../domain/catalog';
import { ingredientFromFood, recipeTotal, scaleNutrients } from '../../domain/foods';
import { createId } from '../../data/id';
import { saveRecipe, validateRecipe } from '../../data/catalogRepository';
import { ActionButton, BackButton, NutrientSummary, Notes } from '../../components/CatalogParts';
import { NumberField, FormError } from '../../components/Fields';
import { FoodPicker } from './FoodPicker';
export function RecipeEditor({ foods, original, mode, onDone, onCancel }: { foods: Food[]; original?: Recipe; mode: 'new' | 'edit' | 'duplicate' | 'once'; onDone: (recipe: Recipe) => void; onCancel: () => void }) {
  const [name, setName] = useState(mode === 'duplicate' ? `${original?.name ?? ''}（コピー）` : original?.name ?? '');
  const [ingredients, setIngredients] = useState(() => structuredClone(original?.ingredients ?? []));
  const [servings, setServings] = useState(String(original?.servings ?? 1));
  const [adding, setAdding] = useState(false), [confirmOverwrite, setConfirmOverwrite] = useState(false);
  useSheetTop(adding ? 'food' : 'editor');
  if (adding) return <div className="form-stack"><BackButton label="材料編集へ" onClick={() => setAdding(false)} /><FoodPicker foods={foods} actionLabel="材料に追加" onChoose={(food, grams) => { setIngredients(current => [...current, ingredientFromFood(food, grams, createId())]); setAdding(false); }} /></div>;
  const draft = { name, ingredients, servings: Number(servings) };
  let total, error = '';
  try { total = recipeTotal(draft); if (!Number.isFinite(draft.servings) || draft.servings <= 0 || draft.servings > 100) throw new Error('食数は0より大きく100以下で入力してください。'); } catch (problem) { error = problem instanceof Error ? problem.message : '入力値を確認してください。'; }
  async function save(kind: 'new' | 'overwrite' | 'once') {
    validateRecipe(draft);
    if ((mode === 'duplicate' || (mode === 'once' && kind === 'new')) && name.trim() === original?.name) throw new Error('元と区別できる別のレシピ名を入力してください。');
    if (kind === 'once') { const now = new Date().toISOString(); onDone({ ...draft, id: original?.id ?? createId(), createdAt: original?.createdAt ?? now, updatedAt: now }); }
    else onDone(await saveRecipe(draft, kind === 'overwrite' ? original?.id : undefined, kind === 'overwrite' ? original?.updatedAt : undefined));
  }
  return <div className="form-stack"><BackButton onClick={onCancel} /><h3>{mode === 'once' ? '今回だけ材料を変更' : mode === 'duplicate' ? 'レシピを複製' : mode === 'edit' ? 'レシピを編集' : '新しいレシピ'}</h3>{mode === 'once' && <p className="catalog-note">「今回だけ」を選ぶと元のレシピは変更されません。次の画面で食べた量を選び、登録してください。</p>}<label className="field"><span>レシピ名</span><input value={name} maxLength={100} placeholder="例：豚キムチ" onChange={event => setName(event.target.value)} /></label><h3>材料</h3>{ingredients.map((item, index) => <div className="ingredient-card" key={item.id}><strong>{item.name}</strong><div className="ingredient-controls"><NumberField label={`材料${index + 1}の重量`} unit="g" value={item.grams === 0 ? '' : String(item.grams)} max={10000} onChange={value => setIngredients(current => current.map(ingredient => ingredient.id === item.id ? { ...ingredient, grams: Number(value) } : ingredient))} /><button className="button danger-subtle" aria-label={`材料${index + 1}を削除`} onClick={() => setIngredients(current => current.filter(ingredient => ingredient.id !== item.id))}>削除</button></div><Notes notes={item.notes} /></div>)}<button className="button secondary" onClick={() => setAdding(true)}>＋ 食品DBから材料を追加</button>{total && <NutrientSummary label="レシピ全体" value={total} />}<h3>何食分？</h3><div className="choice-grid">{[1, 2, 3, 4].map(value => <button key={value} aria-pressed={Number(servings) === value} onClick={() => setServings(String(value))}>{value}食分</button>)}</div><NumberField label="食数（自由入力）" value={servings} onChange={setServings} unit="食分" max={100} /><FormError message={error} />{total && !error && <NutrientSummary label="1食あたり" value={scaleNutrients(total, 1 / Number(servings))} />}{mode === 'once' ? <><ActionButton action={() => save('once')}>今回だけ変更して登録へ</ActionButton><ActionButton className="button secondary" action={() => save('new')}>別レシピとして保存</ActionButton>{confirmOverwrite ? <div className="delete-confirm"><p>元の「{original?.name}」を上書きします。過去の食事記録は変更されません。</p><ActionButton action={() => save('overwrite')}>確認して元のレシピを上書き</ActionButton><button className="button secondary" onClick={() => setConfirmOverwrite(false)}>キャンセル</button></div> : <button className="button secondary" onClick={() => setConfirmOverwrite(true)}>元のレシピを上書き…</button>}</> : <ActionButton action={() => save(mode === 'edit' ? 'overwrite' : 'new')}>{mode === 'edit' ? 'レシピの変更を保存' : 'レシピを保存'}</ActionButton>}</div>;
}
