import { describe, expect, it, vi } from 'vitest';
import generated from '../../public/data/restaurant-search.json';
import type { RestaurantDataset } from '../domain/catalog';
import { buildRestaurantIndex, indexMenu, validateRestaurantIndex, type RestaurantIndex } from '../domain/restaurantIndex';
import { restaurants } from './restaurants';
import { createRestaurantSearchLoader } from './restaurantSearch';
const index = generated as RestaurantIndex;
const raws = import.meta.glob('../../public/data/restaurants/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const text = (file: string) => raws[`../../public/data/restaurants/${file}`];
const data = (file: string): RestaurantDataset => JSON.parse(text(file));
const sources = () => index.chains.map(c => ({ file: c.file, sha256: c.sha256, data: data(c.file) }));
describe('derived restaurant index', () => {
  it('reproduces all 21 chains and 9652 variants exactly from official JSON', () => {
    expect(index.chains).toHaveLength(21); expect(index.items).toHaveLength(9652);
    expect(buildRestaurantIndex(sources(), restaurants)).toEqual(index);
    expect(validateRestaurantIndex(index)).toBe(index);
  });
  it('contains only search fields and kcal; no PFC, provenance or URL', () => {
    const allowed = new Set(['chainId', 'itemId', 'productGroupId', 'name', 'aliases', 'variantName', 'category', 'size', 'servingBasis', 'registrable', 'calories']);
    expect(index.items.every(i => Object.keys(i).every(k => allowed.has(k)))).toBe(true);
    expect(index.items.some(i => i.calories === null)).toBe(true);
    expect(index.items.filter(i => i.registrable)).toHaveLength(6765);
  });
  it.each(['chain', 'count', 'duplicate', 'group', 'calories'] as const)('rejects source mismatch: %s', kind => {
    const s = sources();
    if (kind === 'chain') s[0].data.metadata.restaurantId = 'wrong';
    if (kind === 'count') s[0].data.metadata.variantCount++;
    if (kind === 'duplicate') s[0].data.items[1].id = s[0].data.items[0].id;
    if (kind === 'group') s[0].data.items[0].productGroupId = '';
    if (kind === 'calories') s[0].data.items[0].calories = NaN;
    expect(() => buildRestaurantIndex(s, restaurants)).toThrow();
  });
  it('refuses future index format', () => expect(() => validateRestaurantIndex({ ...index, formatVersion: 2 } as unknown as RestaurantIndex)).toThrow());
});
describe('chain-only loader', () => {
  function setup(mutated?: RestaurantIndex) {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).endsWith('restaurant-search.json') ? new Response(JSON.stringify(mutated ?? index)) : new Response(text(String(url).split('/').at(-1)!)));
    return { fetcher, loader: createRestaurantSearchLoader(fetcher) };
  }
  it('loads only index until selection, then one chain; caches index and chain', async () => {
    const { loader, fetcher } = setup(), chain = index.chains[0];
    await loader.loadIndex(); await loader.loadIndex(); expect(fetcher).toHaveBeenCalledTimes(1);
    const id = index.items.find(i => i.chainId === chain.chainId)!.itemId;
    const a = await loader.resolveItem(chain.chainId, id), b = await loader.resolveItem(chain.chainId, id);
    expect(a.item).toEqual(data(chain.file).items.find(i => i.id === id)); expect(a.items).toBe(b.items);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(String(fetcher.mock.calls[1][0])).toContain(chain.file);
  });
  it('fails exact ID lookup instead of falling back to similar name', async () => { const { loader } = setup(); await expect(loader.resolveItem(index.chains[0].chainId, 'missing')).rejects.toThrow('商品ID'); });
  it('rejects hash mismatch', async () => {
    const wrong = structuredClone(index); wrong.chains[0].sha256 = '0'.repeat(64);
    await expect(setup(wrong).loader.loadChain(wrong.chains[0].chainId)).rejects.toThrow('版が一致');
  });
  it.each(['registrable', 'calories'] as const)('rechecks %s against formal JSON', async field => {
    const wrong = structuredClone(index); const first = wrong.items[0];
    if (field === 'registrable') first.registrable = !first.registrable; else first.calories = (first.calories ?? 0) + 1;
    await expect(setup(wrong).loader.loadChain(first.chainId)).rejects.toThrow('一致');
  });
  it('retains null/blocked details without fabricating nutrients', async () => {
    const item = index.items.find(i => i.calories === null)!, { loader } = setup();
    const result = await loader.resolveItem(item.chainId, item.itemId);
    expect(result.item.calories).toBeNull(); expect(indexMenu(result.item).registrable).toBe(false);
  });
});
