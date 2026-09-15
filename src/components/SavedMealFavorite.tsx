import { useLiveQuery } from 'dexie-react-hooks';
import type { MealEntry } from '../domain/types';
import { db } from '../data/db';
import { favoriteSavedMeal, savedMealFavoriteId } from '../data/reuseMeals';
import { removeFavorite } from '../data/catalogRepository';
import { ActionButton } from './CatalogParts';
export function SavedMealFavorite({ meal }: { meal: MealEntry }) {
  const id = savedMealFavoriteId(meal);
  const favorite = useLiveQuery(() => id ? db.favorites.get(id) : undefined, [id]);
  if (!id) return null;
  return <ActionButton className="button secondary" action={() => favorite ? removeFavorite(id) : favoriteSavedMeal(meal)}>{favorite ? '★ お気に入りを解除' : '☆ この料理をお気に入り'}</ActionButton>;
}
