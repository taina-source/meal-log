import Dexie, { type Table } from 'dexie';
import type { MealEntry, UserSettings, WeightEntry } from '../domain/types';
import type { Favorite, MealSet, Recipe } from '../domain/catalog';
export class MealLogDatabase extends Dexie {
  meals!: Table<MealEntry, string>;
  weights!: Table<WeightEntry, string>;
  settings!: Table<UserSettings & { id: string }, string>;
  recipes!: Table<Recipe, string>;
  favorites!: Table<Favorite, string>;
  mealSets!: Table<MealSet, string>;
  constructor(name = 'meal-log') {
    super(name);
    this.version(1).stores({ meals: 'id, eatenAt, mealType, sourceType', weights: 'id, &date', settings: 'id' });
    // Additive migration. All version-1 rows remain untouched.
    this.version(2).stores({
      meals: 'id, eatenAt, mealType, sourceType, sourceId, setId, [copiedFromId+copyTargetDate]',
      recipes: 'id, name, updatedAt', favorites: 'id, kind, sourceId', mealSets: 'id, name, updatedAt',
    });
    // Indexes only. No row rewrite, clearing, or deletion in any migration.
    this.version(3).stores({ meals: 'id, eatenAt, mealType, sourceType, sourceId, setId, [copiedFromId+copyTargetDate], restaurantId, restaurantOrderId' });
  }
}
export const db = new MealLogDatabase();
