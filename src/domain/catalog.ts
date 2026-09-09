import type { Nutrients } from './types';
export type NutrientStatus = 'numeric' | 'estimated' | 'trace' | 'estimated-trace' | 'missing';
export interface Food {
  id: string; name: string; category: string;
  caloriesPer100g: number | null; proteinPer100g: number | null; fatPer100g: number | null; carbsPer100g: number | null;
  aliases: string[]; source: string; sourceVersion: string;
  raw: Record<keyof Nutrients, string>;
  status: Record<keyof Nutrients, NutrientStatus>;
}
export interface FoodDataset { metadata: { name: string; version: string; sourceUrl: string; sourcePage: string; retrievedAt: string; foodCount: number }; foods: Food[] }
export interface RecipeIngredient { id: string; foodId: string; name: string; grams: number; per100g: Nutrients; sourceVersion: string; notes: string[] }
export interface Recipe { id: string; name: string; ingredients: RecipeIngredient[]; servings: number; createdAt: string; updatedAt: string }
export type FavoriteKind = 'food' | 'recipe' | 'set' | 'restaurant' | 'restaurantMenu';
export interface Favorite { id: string; kind: FavoriteKind; sourceId: string; quantity: number; createdAt: string }
export interface MealSetItem { id: string; kind: 'food' | 'recipe' | 'restaurant'; sourceId: string; name: string; quantity: number; unit: 'g' | 'whole'; nutrients: Nutrients; sourceVersion?: string; notes?: string[]; recipeSnapshot?: Recipe }
export interface MealSet { id: string; name: string; items: MealSetItem[]; total: Nutrients; createdAt: string; updatedAt: string }
export interface RecentItem { kind: FavoriteKind; sourceId: string; name: string; quantity: number; lastUsedAt: string; count: number; score: number; item?: MealSetItem; setSnapshot?: MealSet }
export interface Restaurant { id: string; name: string; category: 'ファストフード' | '牛丼・丼' | '麺類' | 'カレー' | '回転寿司' | '定食・ファミレス'; aliases: string[] }
export type NutrientSourceType = 'official' | 'official_old' | 'secondary' | 'estimate' | 'unknown';
export interface NutrientProvenance {
  value: number | null; sourceType: NutrientSourceType; sourceUrl: string; sourceTitle: string;
  publishedOrUpdatedAt: string | null; retrievedAt: string; notes: string[];
  /** Reserved aliases from the unused Stage 2 contract. */
  url?: string; publishedAt?: string; note?: string;
}
export interface RestaurantMenuItem {
  id: string; restaurantId: string; name: string; aliases: string[]; category: string;
  productGroupId: string; variantName: string; size: string; region: string;
  calories: number | null; protein: number | null; fat: number | null; carbs: number | null;
  nutrientProvenance: Record<keyof Nutrients, NutrientProvenance>;
  rawNutrients: Record<keyof Nutrients, string>;
  isLimitedTime: boolean | null; isCurrent: boolean; sourceVersion: string; notes: string[];
  /** Official nutrition basis; absent for older snapshots. */
  servingBasis?: string;
  quantityUnit?: string;
  piecesPerServing?: number | null;
  registrationBlockedReason?: string;
  availableFrom?: string; availableUntil?: string;
  nutrients?: { [K in keyof Nutrients]: { value: number | null; source: NutrientProvenance } };
  limitedTime?: boolean;
  previousOfficialValues?: { capturedAt: string; nutrients: Nutrients; sources: Partial<Record<keyof Nutrients, NutrientProvenance>> }[];
}
export interface RestaurantDataset { metadata: { restaurantId: string; variantCount: number; productCount: number; retrievedAt: string }; items: RestaurantMenuItem[] }
export interface RestaurantCartLine { item: RestaurantMenuItem; quantity: number }
