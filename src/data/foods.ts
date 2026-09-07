import { useEffect, useState } from 'react';
import type { FoodDataset } from '../domain/catalog';
let cached: Promise<FoodDataset> | undefined;
export function loadFoods(): Promise<FoodDataset> {
  cached ??= fetch(`${import.meta.env.BASE_URL}data/mext-foods.json`).then(async response => {
    if (!response.ok) throw new Error('食品データを読み込めませんでした。');
    const data: FoodDataset = await response.json();
    if (!Array.isArray(data.foods) || !data.metadata || data.foods.length !== data.metadata.foodCount) throw new Error('食品データの形式を確認してください。');
    return data;
  }).catch(error => { cached = undefined; throw error; });
  return cached;
}
export function useFoods() {
  const [data, setData] = useState<FoodDataset>();
  const [error, setError] = useState('');
  useEffect(() => { let active = true; loadFoods().then(result => { if (active) setData(result); }).catch(() => { if (active) setError('食品データを読み込めません。オンラインで一度アプリを開いて準備を完了してください。'); }); return () => { active = false; }; }, []);
  return { data, error };
}
