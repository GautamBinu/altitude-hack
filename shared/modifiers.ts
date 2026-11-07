import type { MenuGroup } from './types'

type GroupLike = Pick<MenuGroup, 'id' | 'name' | 'showDefault' | 'inlineLabel'> & {
  options: { id: number; name: string; isDefault: boolean }[]
}

/**
 * Turns a set of chosen options into the short labels a barista reads on an order line.
 * The server and the cart both use this so the customer sees what the barista sees.
 *
 *   temperature -> "Iced"      milk -> "Oatly"      base -> "Base: Banana"
 */
export function describeSelections(
  groups: GroupLike[],
  selections: Record<string, number[]>,
): string[] {
  const labels: string[] = []
  for (const group of groups) {
    const chosenIds = selections[String(group.id)] ?? []
    const chosen = group.options.filter((o) => chosenIds.includes(o.id))
    if (chosen.length === 0) continue
    if (!group.showDefault && chosen.every((o) => o.isDefault)) continue
    const names = chosen.map((o) => o.name).join(', ')
    labels.push(group.inlineLabel ? names : `${group.name}: ${names}`)
  }
  return labels
}
