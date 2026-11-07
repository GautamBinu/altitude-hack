/**
 * The tags the "What are you in the mood for?" suggester understands, grouped for the dashboard's tag picker.
 * Caffeine and temperature are not here: they come from the item's own fields.
 */
export const MOOD_TAG_GROUPS: { label: string; tags: string[] }[] = [
  {
    label: 'How it feels',
    tags: ['energising', 'calming', 'cozy', 'refreshing', 'light', 'rich', 'indulgent', 'healthy', 'filling', 'classic', 'smooth', 'mild', 'fancy'],
  },
  {
    label: 'How it tastes',
    tags: ['sweet', 'creamy', 'bitter', 'fruity', 'floral', 'nutty', 'chocolatey', 'caramel', 'tart', 'tropical', 'savoury', 'buttery'],
  },
  { label: 'Also', tags: ['strong', 'dessert', 'protein', 'milk-free'] },
]

export const ALL_MOOD_TAGS: string[] = MOOD_TAG_GROUPS.flatMap((group) => group.tags)
