// Pickers hold at most 64 options: Claude Code refuses a Select with more,
// and refuses the whole pane with it. A long list is shown as a window around
// the selected entry, with an entry at either end that steps past the edge.

/** The most options Claude Code draws in one Select. */
export const MAX_SELECT_OPTIONS = 64

/** Option values for the two edge entries; no SHA or path takes this form. */
export const BEFORE_VALUE = 'commit-walk:before'
export const AFTER_VALUE = 'commit-walk:after'

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
 * The window of `items` around index `at` that fits `max` options, the two
 * edge entries included. A list that fits is drawn whole.
 */
export function windowAround<T>(items: readonly T[], at: number, max = MAX_SELECT_OPTIONS): ListWindow<T> {
  if (items.length <= max) return { items: [...items], start: 0, before: 0, after: 0 }
  const size = Math.max(1, max - 2)
  const centre = Math.min(Math.max(at, 0), items.length - 1)
  const start = Math.min(Math.max(centre - Math.floor(size / 2), 0), items.length - size)
  const end = start + size
  return { items: items.slice(start, end), start, before: start, after: items.length - end }
}

/**
 * The index a pick lands on: an entry's own index, or the first entry past
 * the window's edge for an edge entry. -1 when the value is not drawn.
 */
export function pickedIndex<T>(win: ListWindow<T>, value: string, valueOf: (item: T) => string): number {
  if (value === BEFORE_VALUE) return win.before > 0 ? win.start - 1 : -1
  if (value === AFTER_VALUE) return win.after > 0 ? win.start + win.items.length : -1
  const at = win.items.findIndex(item => valueOf(item) === value)
  return at < 0 ? -1 : win.start + at
}
