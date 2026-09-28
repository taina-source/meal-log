import type { RestaurantDataset, RestaurantMenuItem } from '../domain/catalog';
import { indexMenu, validateRestaurantIndex, type RestaurantIndex } from '../domain/restaurantIndex';

// Injectable loader keeps tests isolated and never accesses the user database.
export function createRestaurantSearchLoader(fetcher: typeof fetch = (...args) => fetch(...args)) {
  let index: Promise<RestaurantIndex> | undefined;
  const chains = new Map<string, Promise<RestaurantMenuItem[]>>();
  const loadIndex = () => index ??= fetcher(`${import.meta.env.BASE_URL}data/restaurant-search.json`).then(async response => {
    if (!response.ok) throw new Error('外食検索データを読み込めません。');
    return validateRestaurantIndex(await response.json());
  }).catch(error => { index = undefined; throw error; });
  const loadChain = async (chainId: string) => {
    const catalog = await loadIndex(), chain = catalog.chains.find(c => c.chainId === chainId);
    if (!chain) throw new Error('店舗IDが見つかりません。');
    let pending = chains.get(chainId);
    if (!pending) {
      pending = (async () => {
        const response = await fetcher(`${import.meta.env.BASE_URL}data/restaurants/${chain.file}`);
        if (!response.ok) throw new Error('店舗の正式データを読み込めません。');
        const bytes = await response.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
        if (hash !== chain.sha256) throw new Error('検索データと正式データの版が一致しません。アプリの更新を完了してください。');
        const data: RestaurantDataset = JSON.parse(new TextDecoder().decode(bytes));
        const expected = new Map(catalog.items.filter(i => i.chainId === chainId).map(i => [i.itemId, i]));
        if (data.metadata.restaurantId !== chainId || data.items.length !== chain.count || data.metadata.variantCount !== chain.count || new Set(data.items.map(i => i.id)).size !== chain.count) throw new Error('店舗データの件数が一致しません。');
        for (const item of data.items) if (JSON.stringify(indexMenu(item)) !== JSON.stringify(expected.get(item.id))) throw new Error('商品IDまたは検索データが一致しません。');
        return data.items;
      })().catch(error => { chains.delete(chainId); throw error; });
      chains.set(chainId, pending);
    }
    return pending;
  };
  const resolveItem = async (chainId: string, itemId: string) => {
    const items = await loadChain(chainId), item = items.find(i => i.id === itemId);
    if (!item) throw new Error('商品IDが見つかりません。');
    return { item, items };
  };
  return { loadIndex, loadChain, resolveItem };
}
export const restaurantSearchLoader = createRestaurantSearchLoader();
