// Long lists are drawn as a window of rows around the selected entry, with a
// row at either end that steps past the edge, so a list of any length stays
// a few rows tall in the pane.

export type ListWindow<T> = {
  /** The entries drawn. */
  items: T[]
  /** Index of the first drawn entry in the whole list. */
  start: number
  /** Entries left out before and after the window. */
  before: number
  after: number
}

/**
 * The window of `items` around index `at` that fits `max` rows, the two edge
 * rows included. A list that fits is drawn whole.
 */
export function windowAround<T>(items: readonly T[], at: number, max: number): ListWindow<T> {
  if (items.length <= max) return { items: [...items], start: 0, before: 0, after: 0 }
  const size = Math.max(1, max - 2)
  const centre = Math.min(Math.max(at, 0), items.length - 1)
  const start = Math.min(Math.max(centre - Math.floor(size / 2), 0), items.length - size)
  const end = start + size
  return { items: items.slice(start, end), start, before: start, after: items.length - end }
}
