import { db, type MealLogDatabase } from './db';
import { makeBackup, parseBackup, validateBackup, backupTables, checkBackupSize, type Backup } from '../domain/backup';

export async function exportBackup(database: MealLogDatabase = db, exportedAt = new Date().toISOString()): Promise<Backup> {
  const data = await database.transaction('r', backupTables.map(t => database.table(t)), async () => ({
    meals: await database.meals.toArray(), weights: await database.weights.toArray(), settings: await database.settings.toArray(),
    recipes: await database.recipes.toArray(), favorites: await database.favorites.toArray(), mealSets: await database.mealSets.toArray(),
  }));
  return makeBackup(data, exportedAt);
}
export function backupText(backup: Backup) {
  const text = JSON.stringify(backup, null, 2); checkBackupSize(new TextEncoder().encode(text).byteLength); return text;
}
export async function readBackupFile(file: Pick<File, 'size' | 'text'>) {
  checkBackupSize(file.size); return parseBackup(await file.text());
}
export async function restoreBackup(input: unknown, database: MealLogDatabase = db): Promise<void> {
  // Validate and clone again before touching any current row; preview is not a write authorization.
  const backup = validateBackup(input);
  await database.transaction('rw', backupTables.map(t => database.table(t)), async () => {
    // Explicit user-confirmed full replacement only. Every clear and write is in this transaction.
    for (const table of backupTables) await database.table(table).clear();
    await database.meals.bulkAdd(backup.data.meals);
    await database.weights.bulkAdd(backup.data.weights);
    await database.recipes.bulkAdd(backup.data.recipes);
    await database.mealSets.bulkAdd(backup.data.mealSets);
    await database.favorites.bulkAdd(backup.data.favorites);
    await database.settings.bulkAdd(backup.data.settings);
  });
}
