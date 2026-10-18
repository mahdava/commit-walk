// What every part of the pane draws with: the values read for this draw, the
// actions its buttons take, the surface's elements, and the room it has.
//
// The pane's parts never take `$`: Claude Code before 2.1.300 follows `$`
// only into functions of the file that holds it. register.tsx reads the
// values and builds the actions; the parts here only draw.

import type { ElementTable } from 'claude-code'

import type { About, Expandable, GitTrace, Selection, Snapshot } from '../../types'
import type { Depth } from '../state'
import type { ListScroll } from '../window'

/** Everything the pane draws from, read once per draw. The debug values only while it is shown. */
export type PaneValues = {
  sel: Selection
  snap: Snapshot
  open: Expandable | null
  scrolled: Record<string, ListScroll>
  isDebug: boolean
  gitRuns: GitTrace[]
  where: About | null
}

/** What the pane's buttons do; each starts its work and returns at once. */
export type Actions = {
  load: (depth: Depth, change?: Partial<Selection>) => void
  stepCommit: (delta: 1 | -1) => void
  stepFile: (delta: 1 | -1) => void
  toggleDebug: () => void
  toggleList: (which: Expandable) => void
  foldLists: () => void
  scrollList: (prefix: string, at: ListScroll) => void
}

/** Where the pane is drawn, from the render event. */
export type Place = { bodyColumns: number; bodyRows: number; placement: string; surface: string }

export type Frame = PaneValues & {
  act: Actions
  /** The surface's elements: Box, Text, Button, Code. */
  ui: ElementTable
  place: Place
  /** Columns to draw in, never fewer than 24. */
  width: number
  /** A framed list's inner width: lists are whole-row buttons, so a row is that wide. */
  inner: number
}

export function frameOf(values: PaneValues, act: Actions, ui: ElementTable, place: Place): Frame {
  const width = Math.max(24, place.bodyColumns)
  return { ...values, act, ui, place, width, inner: Math.max(10, width - 2) }
}

/** `text` padded or cut to exactly `room` columns, a framed row by default. */
export function pad(f: Frame, text: string, room = f.inner): string {
  return text.padEnd(room).slice(0, room)
}
