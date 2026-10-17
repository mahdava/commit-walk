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

/** Where a list was scrolled to, and which entry was selected then. */
export type ListScroll = { start: number; anchor: string | null }

/**
 * The first row a list of `length` entries draws, `size` rows at a time. A
 * scroll the person made holds while the selection is the one it was made
 * with, or while a new selection is in view; a selection out of view brings
 * the list back around it.
 */
export function scrollStart(length: number, at: number, size: number, scrolled: ListScroll | undefined, selected: string | null): number {
  if (length <= size) return 0
  const last = length - size
  const clamp = (n: number) => Math.min(Math.max(n, 0), last)
  const centred = clamp(Math.max(at, 0) - Math.floor(size / 2))
  if (scrolled === undefined) return centred
  const start = clamp(scrolled.start)
  if (scrolled.anchor === selected) return start
  return at >= start && at < start + size ? start : centred
}
