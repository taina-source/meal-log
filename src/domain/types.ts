export const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = typeof mealTypes[number];
export type SourceType = 'manual' | 'official' | 'official_old' | 'secondary' | 'database' | 'estimate' | 'ai_estimate' | 'barcode' | 'recipe' | 'chatgpt';
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
  chatgptSnapshot?: import('./chatgpt').ChatgptSnapshot;
  chatgptImportId?: string;
  chatgptUserModified?: boolean;
  chatgptModifiedBeforeSave?: boolean;
  chatgptUnit?: string;
  sourceId?: string;
  sourceVersion?: string;
  quantity?: number;
  unit?: 'g' | 'whole' | 'item';
  restaurantId?: string;
  restaurantName?: string;
  restaurantOrderId?: string;
  restaurantSnapshot?: import('./catalog').RestaurantMenuItem;
  nutrientProvenance?: Record<keyof Nutrients, import('./catalog').NutrientProvenance>;
  manuallyEditedNutrition?: boolean;
  notes?: string[];
  recipeSnapshot?: import('./catalog').Recipe;
  setId?: string;
  setName?: string;
  setRunId?: string;
  copiedFromId?: string;
  copyTargetDate?: string;
}
export interface UserSettings {
  calorieTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbsTarget: number;
  targetWeight: number | null;
  theme: 'system' | 'light' | 'dark';
  showPfcDecimals: boolean;
  analysisExcludeLowCalories?: boolean;
  analysisMinimumCalories?: number;
  quickPfcPercentages?: { protein: number; fat: number; carbs: number };
  pendingHealthExport?: import('./healthExport').PendingHealthExport;
}
export interface WeightEntry {
  id: string; date: string; createdAt: string;
  /** Legacy weight records remain readable without rewriting stored rows. */
  weight?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  healthExport?: Partial<Record<import('./measurements').MeasurementField, { value: number; exportedAt: string }>>;
}
export type MealInput = Pick<MealEntry, 'name' | 'mealType' | 'eatenAt' | keyof Nutrients>;
export const mealLabels: Record<MealType, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };
export const defaultSettings: UserSettings = { calorieTarget: 2400, proteinTarget: 180, fatTarget: 70, carbsTarget: 260, targetWeight: null, theme: 'system', showPfcDecimals: true };
