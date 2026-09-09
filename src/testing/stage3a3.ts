import type { RestaurantDataset } from '../domain/catalog';
const raw = import.meta.glob<string>('../../public/data/restaurants/{gusto,joyfull,tenka,ohsho,sushiro,kura,hama}.json', { query: '?raw', import: 'default', eager: true });
export const stage3a3Datasets = Object.values(raw).map(text => JSON.parse(text) as RestaurantDataset);
export const stage3a3Menus = stage3a3Datasets.flatMap(d => d.items);
