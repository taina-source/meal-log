import { useEffect, useState } from 'react';
import type { RestaurantDataset, RestaurantMenuItem } from '../domain/catalog';
export const restaurantFiles = ['mcdonalds', 'kfc', 'mos', 'sukiya', 'yoshinoya', 'matsuya', 'marugame', 'subway', 'nakau', 'hanamaru', 'coco', 'ootoya', 'royalhost', 'bikkuri'] as const;
let cached: Promise<RestaurantMenuItem[]> | undefined;
export function loadRestaurantMenus() {
  cached ??= Promise.all(restaurantFiles.map(async name => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/restaurants/${name}.json`);
    if (!response.ok) throw new Error('外食データを読み込めませんでした。');
    const data: RestaurantDataset = await response.json();
    if (!Array.isArray(data.items) || !data.metadata || data.items.length !== data.metadata.variantCount || data.items.some(item => item.restaurantId !== data.metadata.restaurantId)) throw new Error('外食データの形式が正しくありません。');
    return data.items;
  })).then(data => data.flat()).catch(error => { cached = undefined; throw error; });
  return cached;
}
export function useRestaurantMenus() {
  const [items, setItems] = useState<RestaurantMenuItem[]>(), [error, setError] = useState('');
  useEffect(() => { let active = true; loadRestaurantMenus().then(data => { if (active) setItems(data); }).catch(() => { if (active) setError('外食データを読み込めません。オンラインでアプリの更新を完了してから、もう一度開いてください。'); }); return () => { active = false; }; }, []);
  return { items, error };
}
