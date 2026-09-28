// Derived catalog only; the 21 source files are never modified.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { restaurantFiles, buildRestaurantIndex } = await server.ssrLoadModule('/src/domain/restaurantIndex.ts');
  const { restaurants } = await server.ssrLoadModule('/src/data/restaurants.ts');
  const sources = await Promise.all(restaurantFiles.map(async name => {
    const file = `${name}.json`, bytes = await readFile(new URL(`../public/data/restaurants/${file}`, import.meta.url));
    return { file, sha256: createHash('sha256').update(bytes).digest('hex'), data: JSON.parse(bytes) };
  }));
  const text = JSON.stringify(buildRestaurantIndex(sources, restaurants));
  await writeFile(new URL('../public/data/restaurant-search.json', import.meta.url), text + '\n');
  console.log(`Restaurant search: ${sources.length} chains, ${Buffer.byteLength(text) + 1} bytes`);
} finally { await server.close(); }
