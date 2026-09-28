import { useEffect, useState } from 'react';
import type { RestaurantDataset, RestaurantMenuItem } from '../domain/catalog';
import { restaurantSearchLoader } from './restaurantSearch';
export const restaurantFiles = ['mcdonalds', 'kfc', 'mos', 'sukiya', 'yoshinoya', 'matsuya', 'marugame', 'subway', 'nakau', 'hanamaru', 'coco', 'ootoya', 'royalhost', 'bikkuri', 'gusto', 'joyfull', 'tenka', 'ohsho', 'sushiro', 'kura', 'hama'] as const;
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
export function useRestaurantMenus(chainId?: string, itemId?: string) {
  const [items, setItems] = useState<RestaurantMenuItem[]>(), [error, setError] = useState('');
  useEffect(() => { let active = true; setItems(undefined); setError(''); const load = chainId ? itemId ? restaurantSearchLoader.resolveItem(chainId, itemId).then(result => result.items) : restaurantSearchLoader.loadChain(chainId) : loadRestaurantMenus(); load.then(data => { if (active) setItems(data); }).catch(problem => { if (active) setError(problem instanceof Error ? problem.message : '外食データを読み込めません。オンラインでアプリの更新を完了してください。'); }); return () => { active = false; }; }, [chainId, itemId]);
  return { items, error };
}
