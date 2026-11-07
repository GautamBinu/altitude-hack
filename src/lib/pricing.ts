import type { MenuGroup, MenuItem } from '@shared/types'

/** Selections a customer has made: group id to option ids. */
export type Selections = Record<string, number[]>

/** What the item sheet opens with: the default choice in every required single-choice group. */
export function defaultSelections(groups: MenuGroup[]): Selections {
  const selections: Selections = {}
  for (const group of groups) {
    if (group.kind === 'single') {
      const preferred = group.options.find((o) => o.isDefault) ?? (group.required ? group.options[0] : undefined)
      selections[String(group.id)] = preferred ? [preferred.id] : []
    } else {
      selections[String(group.id)] = []
    }
  }
  return selections
}

/** Price of one unit for display. The server prices every order again from its own menu. */
export function unitPriceFils(item: MenuItem, selections: Selections): number {
  let price = item.priceFils
  for (const group of item.groups) {
    const ids = selections[String(group.id)] ?? []
    for (const option of group.options) if (ids.includes(option.id)) price += option.priceDeltaFils
  }
  return price
}

/** The default choices, with hot or iced picked when the item has that choice. */
export function selectionsWithTemperature(item: MenuItem, temperature: 'hot' | 'iced' | null): Selections {
  const selections = defaultSelections(item.groups)
  if (!temperature) return selections
  const group = item.groups.find((g) => g.key === 'temperature')
  const option = group?.options.find((o) => o.name.toLowerCase() === temperature)
  if (group && option) selections[String(group.id)] = [option.id]
  return selections
}

/** True when every required group has a choice. */
export function selectionsComplete(groups: MenuGroup[], selections: Selections): boolean {
  return groups.every((g) => !g.required || (selections[String(g.id)]?.length ?? 0) > 0)
}
