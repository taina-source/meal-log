import Dexie, { type Table } from 'dexie';
import type { MealEntry, UserSettings, WeightEntry } from '../domain/types';
export class MealLogDatabase extends Dexie {
  meals!: Table<MealEntry, string>;
  weights!: Table<WeightEntry, string>;
  settings!: Table<UserSettings & { id: string }, string>;
  constructor(name = 'meal-log') {
    super(name);
    this.version(1).stores({ meals: 'id, eatenAt, mealType, sourceType', weights: 'id, &date', settings: 'id' });
  }
}
export const db = new MealLogDatabase();
