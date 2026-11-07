import { SEED_CATEGORIES, type SeedItem } from './seed-data'
import { slugify } from './slug'

/**
 * Mood and flavour tags for every menu item, used by the "What are you in the mood for?" suggester.
 *
 * These are our own reading of the menu, not Altitude's. The team can change any item's tags in the
 * dashboard (Menu, edit an item, Tags). The words are the vocabulary the suggester understands:
 *
 *   feel     energising calming cozy refreshing light rich indulgent healthy filling classic smooth mild fancy
 *   taste    sweet creamy bitter fruity floral nutty chocolatey caramel tart tropical savoury buttery
 *   other    dessert protein strong milk-free (only where the description makes it certain)
 *
 * Caffeine and temperature tags (caffeinated, caffeine-free, hot, iced) come from the item itself.
 */
export const MOOD_TAGS: Record<string, string[]> = {
  // Espresso Bar
  'Single Espresso': ['bitter', 'energising', 'classic', 'light', 'milk-free'],
  'Double Espresso': ['bitter', 'energising', 'classic', 'milk-free'],
  Americano: ['bitter', 'classic', 'light', 'milk-free'],
  Cortado: ['classic', 'smooth'],
  Piccolo: ['classic', 'smooth'],
  'Flat White': ['classic', 'smooth', 'cozy'],
  'Cafe Latte': ['classic', 'cozy', 'mild'],
  Affogato: ['indulgent', 'rich', 'dessert'],
  'Raf Coffee': ['indulgent', 'cozy', 'rich'],
  'Spanish Latte': ['cozy', 'indulgent', 'rich'],
  'Rose Spanish Latte': ['floral', 'fancy', 'indulgent'],
  'Spanish Saffron Latte': ['floral', 'fancy', 'indulgent'],
  'Pistachio Spanish Latte': ['nutty', 'indulgent', 'rich'],
  'Dark Caramel Latte': ['caramel', 'indulgent', 'cozy'],
  'Nutella Latte': ['chocolatey', 'nutty', 'indulgent', 'rich', 'dessert'],
  'Iced Coffee Milkshake': ['indulgent', 'rich', 'refreshing', 'dessert', 'filling'],
  'Strawberry Latte': ['refreshing', 'fancy'],
  'Peanut Butter Latte': ['nutty', 'rich', 'filling', 'indulgent'],
  'Caramel Cloud Latte': ['caramel', 'indulgent', 'cozy'],
  // Manual Bar
  Aeropress: ['smooth', 'light', 'mild', 'milk-free'],
  V60: ['smooth', 'light', 'fancy', 'milk-free'],
  Chemex: ['smooth', 'light', 'fancy', 'milk-free'],
  'Iced Slow Drip': ['smooth', 'refreshing', 'light', 'energising', 'milk-free'],
  'Red Eye': ['bitter', 'energising', 'milk-free'],
  'Black Eye': ['bitter', 'energising', 'milk-free'],
  'Death Eye': ['bitter', 'energising', 'milk-free'],
  // Tea
  'Black Tea': ['classic', 'cozy', 'mild', 'milk-free'],
  'Green Tea': ['light', 'mild', 'calming', 'healthy', 'milk-free'],
  'Rooibos Tea': ['calming', 'cozy', 'mild', 'healthy', 'milk-free'],
  'Hibiscus Tea': ['tart', 'calming', 'light', 'milk-free'],
  // Caffeine Free
  'Summer Zest': ['refreshing', 'light'],
  'Lavender Spritzer': ['refreshing', 'light', 'calming'],
  'Pomegranate Punch': ['refreshing', 'tart', 'light'],
  'Hot Chocolate / Nutella': ['chocolatey', 'cozy', 'indulgent', 'dessert'],
  'Pina Colada': ['refreshing', 'tropical'],
  'Mango Mango': ['refreshing', 'tropical'],
  'Banana Chocolate-Protein Shake': ['chocolatey', 'protein', 'healthy', 'filling'],
  // Smoothies
  'Pash N Shoot': ['tropical', 'refreshing', 'healthy'],
  'Strawberry Split': ['refreshing', 'healthy', 'filling'],
  'Tropical Colada': ['tropical', 'refreshing', 'healthy'],
  'Avo Go Go': ['healthy', 'filling', 'tropical'],
  'Big 5': ['refreshing', 'healthy'],
  'Berry Go Round': ['refreshing', 'healthy', 'tart'],
  // Real Milkshakes
  'Chocolate Milkshake': ['chocolatey', 'indulgent', 'rich', 'dessert', 'filling'],
  'Strawberry Milkshake': ['indulgent', 'rich', 'dessert', 'filling'],
  'Vanilla Milkshake': ['indulgent', 'rich', 'dessert', 'filling'],
  // Snacks and food
  'Acai Bowl': ['healthy', 'filling', 'refreshing'],
  'Acai Smoothie': ['healthy', 'refreshing'],
  'Assorted Muffins': ['filling', 'dessert'],
  Sandwiches: ['savoury', 'filling'],
  Croissants: ['buttery', 'classic'],
  'Snow Ice': ['refreshing', 'dessert', 'light'],
}

/** Every tag an item starts with: its own, the caffeine and temperature ones, and the mood tags above. */
export function tagsFor(item: SeedItem): string[] {
  const tags = [
    ...(item.tags ?? []),
    item.caffeineFree ? 'caffeine-free' : 'caffeinated',
    ...(item.temp === 'both' ? ['hot', 'iced'] : item.temp === 'none' ? [] : [item.temp]),
    ...(MOOD_TAGS[item.name] ?? []),
  ]
  return [...new Set(tags)]
}

/** Slug to starting tags, for adding mood tags to a database that was seeded before they existed. */
export function seedTagsBySlug(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const category of SEED_CATEGORIES) for (const item of category.items) map.set(slugify(item.name), tagsFor(item))
  return map
}
