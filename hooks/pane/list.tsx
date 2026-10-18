// The pane's lists: worktrees, commits and files. Every row is a whole-row
// button, so its full width is the click target.

import type { Expandable } from '../../types'
import { clip } from '../labels'
import { LIST_ROWS } from '../state'
import { TONE_COLOR } from '../welcome'
import { scrollStart } from '../window'
import { pad, type Frame } from './frame'

export type ListSpec<T> = {
  /** Names the list's keys: `<prefix>:<entry>`, `<prefix>-up`, `<prefix>-down`. */
  prefix: string
  items: readonly T[]
  at: number
  keyOf: (item: T) => string
  tagOf?: (item: T) => { text: string; color: string | undefined }
  textOf: (item: T) => string
  noun: { one: string; many: string }
  onPick: (item: T) => void
}

/**
 * The full text of a clipped row, revealed while the pointer is over the
 * row (its keyed Box): drawn below it, over the rows that follow, without
 * moving them. Inverse video makes it a solid block in any theme. Claude
 * Code shows it where the terminal reports the pointer; no hook runs.
 */
function hoverCard(f: Frame, key: string, full: string, indent: number) {
  const { Box, Text } = f.ui
  const cardWidth = Math.max(10, f.inner - indent - 1)
  const lines: string[] = []
  for (let at = 0; at < full.length; at += cardWidth - 2) lines.push(full.slice(at, at + cardWidth - 2))
  return (
    // No key: a keyed Box would scope the hover to itself, hidden and never hovered. The row's keyed Box is the scope.
    <Box position="absolute" top={1} left={indent} display="none" hover={{ display: 'flex' }} flexDirection="column">
      {lines.map((line, i) => (
        <Text key={`${key}-${i}`} inverse>{` ${line.padEnd(cardWidth - 2)} `}</Text>
      ))}
    </Box>
  )
}

/**
 * The rows of a list, LIST_ROWS at a time. Each row: a ▶ on the selected
 * one, an optional coloured tag, the entry's text as a whole-row button.
 * A longer list gets a scroll column on the right: ▲ and ▼ page through it
 * without changing the selection, and a thumb shows where the rows are.
 */
export function rowList<T>(f: Frame, spec: ListSpec<T>) {
  const { Box, Text, Button } = f.ui
  const total = spec.items.length
  const size = Math.min(LIST_ROWS, total)
  const selectedKey = spec.items[spec.at] === undefined ? null : spec.keyOf(spec.items[spec.at] as T)
  const start = scrollStart(total, spec.at, LIST_ROWS, f.scrolled[spec.prefix], selectedKey)
  const shown = spec.items.slice(start, start + size)
  const hasBar = total > LIST_ROWS
  const room = hasBar ? f.inner - 2 : f.inner
  const last = total - LIST_ROWS
  const scrollTo = (to: number) => void f.act.scrollList(spec.prefix, { start: Math.min(Math.max(to, 0), last), anchor: selectedKey })

  const rows = shown.map((item, i) => {
    const isSelected = start + i === spec.at
    const tag = spec.tagOf?.(item)
    const used = 2 + (tag ? tag.text.length + 2 : 0)
    const full = spec.textOf(item)
    const isClipped = full.length > room - used - 1
    return (
      // The marker and the coloured tag are text in front of the button,
      // which holds one string: Claude Code before 2.1.300 refuses a
      // Button with element children.
      <Box key={`${spec.prefix}-row:${spec.keyOf(item)}`} flexDirection="row">
        <Text color={isSelected ? TONE_COLOR.petal : undefined} bold={isSelected}>{isSelected ? '▶ ' : '  '}</Text>
        {tag ? <Text color={tag.color}>{tag.text}  </Text> : null}
        <Button key={`${spec.prefix}:${spec.keyOf(item)}`} plain onPress={() => spec.onPick(item)}>
          {pad(f, clip(full, room - used - 1), room - used)}
        </Button>
        {isClipped ? hoverCard(f, `${spec.prefix}-card:${spec.keyOf(item)}`, full, used) : null}
      </Box>
    )
  })
  if (!hasBar) return <Box flexDirection="column">{rows}</Box>

  // The scroll column: ▲, a track with the thumb, ▼; one cell per row.
  const track = size - 2
  const thumb = Math.max(1, Math.round((track * size) / total))
  const thumbAt = last === 0 ? 0 : Math.round(((track - thumb) * start) / last)
  const atTop = start === 0
  const atEnd = start >= last
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box flexDirection="column">{rows}</Box>
        <Text> </Text>
        <Box flexDirection="column">
          <Button key={`${spec.prefix}-up`} plain dimColor={atTop} onPress={() => scrollTo(start - (LIST_ROWS - 1))}>▲</Button>
          {Array.from({ length: track }, (_, i) => (
            <Text key={`${spec.prefix}-track-${i}`} dimColor={i < thumbAt || i >= thumbAt + thumb}>
              {i >= thumbAt && i < thumbAt + thumb ? '┃' : '│'}
            </Text>
          ))}
          <Button key={`${spec.prefix}-down`} plain dimColor={atEnd} onPress={() => scrollTo(start + (LIST_ROWS - 1))}>▼</Button>
        </Box>
      </Box>
      <Text dimColor wrap="truncate-end">{`  ${start + 1}–${start + size} of ${total} ${spec.noun.many} · ▲ ▼ scroll`}</Text>
    </Box>
  )
}

/**
 * A list folded into one framed row showing the current entry: a press on
 * the row opens it below, another press or a pick folds it again.
 */
export function foldable<T>(f: Frame, spec: ListSpec<T> & { which: Expandable; label: string; current: string }) {
  const { Box, Button } = f.ui
  const isOpen = f.open === spec.which
  const head = pad(f, `${spec.label}${clip(spec.current, f.inner - spec.label.length - 3)}`, f.inner - 2)
  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor>
      <Button key={`${spec.which}-toggle`} plain onPress={() => void f.act.toggleList(spec.which)}>
        {`${head}${isOpen ? ' ▴' : ' ▾'}`}
      </Button>
      {isOpen
        ? rowList(f, {
            ...spec,
            onPick: item => {
              void f.act.foldLists()
              spec.onPick(item)
            },
          })
        : null}
    </Box>
  )
}
