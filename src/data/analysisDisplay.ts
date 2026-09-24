import { db, type MealLogDatabase } from './db';
import { defaultSettings } from '../domain/types';
import { normalizeSeries, normalizeSectionOrder } from '../domain/analysisDisplay';

// Patch the latest row inside a transaction, preserving unrelated settings and pending exports.
export async function saveAnalysisDisplay(change: { series?: unknown; order?: unknown }, database: MealLogDatabase = db) {
  await database.transaction('rw', database.settings, async () => {
    const current = await database.settings.get('user') ?? { ...defaultSettings, id: 'user' };
    if (change.series !== undefined) current.analysisSeries = normalizeSeries(change.series);
    if (change.order !== undefined) current.analysisSectionOrder = normalizeSectionOrder(change.order);
    await database.settings.put(current);
  });
}
