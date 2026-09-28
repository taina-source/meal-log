import type { Restaurant, RestaurantDataset } from './catalog';
import { isComplete } from './restaurantMenus';

export const restaurantFiles = ['mcdonalds', 'kfc', 'mos', 'sukiya', 'yoshinoya', 'matsuya', 'marugame', 'subway', 'nakau', 'hanamaru', 'coco', 'ootoya', 'royalhost', 'bikkuri', 'gusto', 'joyfull', 'tenka', 'ohsho', 'sushiro', 'kura', 'hama'] as const;
export interface SearchChain { chainId: string; chainName: string; chainAliases: string[]; file: string; sha256: string; count: number }
export interface SearchMenu {
  chainId: string; itemId: string; productGroupId: string; name: string; aliases: string[];
  variantName: string; category: string; size: string; servingBasis?: string;
  registrable: boolean; calories: number | null;
}
export interface RestaurantIndex { formatVersion: 1; chains: SearchChain[]; items: SearchMenu[] }
export function indexMenu(item: RestaurantDataset['items'][number]): SearchMenu {
  return { chainId: item.restaurantId, itemId: item.id, productGroupId: item.productGroupId, name: item.name,
    aliases: item.aliases, variantName: item.variantName, category: item.category, size: item.size,
    ...(item.servingBasis !== undefined ? { servingBasis: item.servingBasis } : {}),
    registrable: isComplete(item), calories: item.calories };
}
export function buildRestaurantIndex(sources: { file: string; sha256: string; data: RestaurantDataset }[], stores: Restaurant[]): RestaurantIndex {
  const chains: SearchChain[] = [], items: SearchMenu[] = [], ids = new Set<string>(), chainIds = new Set<string>();
  for (const { file, sha256, data } of sources) {
    const store = stores.find(s => s.id === data.metadata.restaurantId);
    if (!store || chainIds.has(store.id) || !restaurantFiles.some(f => `${f}.json` === file) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Invalid chain: ${file}`);
    chainIds.add(store.id);
    if (data.items.length !== data.metadata.variantCount || new Set(data.items.map(i => i.productGroupId)).size !== data.metadata.productCount) throw new Error(`Count mismatch: ${file}`);
    for (const item of data.items) {
      if (!item.id || ids.has(item.id) || item.restaurantId !== store.id || !item.productGroupId || !item.name.trim()) throw new Error(`Invalid item: ${file}/${item.id}`);
      if (item.calories !== null && (!Number.isFinite(item.calories) || item.calories < 0)) throw new Error(`Invalid calories: ${item.id}`);
      ids.add(item.id); items.push(indexMenu(item));
    }
    chains.push({ chainId: store.id, chainName: store.name, chainAliases: store.aliases, file, sha256, count: data.items.length });
  }
  if (chainIds.size !== stores.length || chains.length !== restaurantFiles.length) throw new Error('Missing chains');
  return { formatVersion: 1, chains, items };
}
export function validateRestaurantIndex(index: RestaurantIndex): RestaurantIndex {
  if (index?.formatVersion !== 1 || !Array.isArray(index.chains) || !Array.isArray(index.items) || index.chains.length !== restaurantFiles.length) throw new Error('外食検索データの形式が正しくありません。');
  const ids = new Set<string>();
  for (const chain of index.chains) {
    if (!restaurantFiles.some(f => `${f}.json` === chain.file) || !/^[a-f0-9]{64}$/.test(chain.sha256) || index.items.filter(i => i.chainId === chain.chainId).length !== chain.count) throw new Error('外食検索データの件数が一致しません。');
  }
  for (const item of index.items) {
    if (ids.has(item.itemId) || !item.itemId || !index.chains.some(c => c.chainId === item.chainId) || typeof item.name !== 'string' || !Array.isArray(item.aliases) || typeof item.registrable !== 'boolean' || (item.calories !== null && (!Number.isFinite(item.calories) || item.calories < 0))) throw new Error('外食検索データの商品が不正です。');
    ids.add(item.itemId);
  }
  return index;
}
