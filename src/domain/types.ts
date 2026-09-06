export const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = typeof mealTypes[number];
export type SourceType = 'manual' | 'official' | 'official_old' | 'database' | 'estimate' | 'ai_estimate' | 'barcode' | 'recipe';
export interface Nutrients { calories: number; protein: number; fat: number; carbs: number }
export interface MealEntry extends Nutrients {
  id: string;
  name: string;
  restaurant: string;
  mealType: MealType;
  eatenAt: string;
  createdAt: string;
  updatedAt: string;
  sourceType: SourceType;
  confidence: number | null;
}
export interface UserSettings {
  calorieTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbsTarget: number;
  targetWeight: number | null;
  theme: 'system' | 'light' | 'dark';
  showPfcDecimals: boolean;
}
export interface WeightEntry { id: string; date: string; weight: number; createdAt: string }
export type MealInput = Pick<MealEntry, 'name' | 'mealType' | 'eatenAt' | keyof Nutrients>;
export const mealLabels: Record<MealType, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };
export const defaultSettings: UserSettings = { calorieTarget: 2400, proteinTarget: 180, fatTarget: 70, carbsTarget: 260, targetWeight: null, theme: 'system', showPfcDecimals: true };
