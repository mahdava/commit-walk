// Which commits the list starts from: every option the worktree offers, one
// button each, the chosen one primary. Hidden where only the whole history is
// on offer.

import type { RangeMode } from '../../types'
import type { Frame } from './frame'

export function rangeRow(f: Frame) {
  const { Box, Text, Button } = f.ui
  const { snap } = f
  const options: { mode: RangeMode; label: string }[] = [
    { mode: 'all', label: 'all' },
    ...(snap.ranges.notInDefault ? [{ mode: 'notInDefault' as const, label: `not in ${snap.ranges.notInDefault.ref} · ${snap.ranges.notInDefault.count}` }] : []),
    ...(snap.ranges.base ? [{ mode: 'base' as const, label: `since ${snap.ranges.base.ref} · ${snap.ranges.base.count}` }] : []),
  ]
  if (options.length < 2) return null
  // `h` cycles through them: it sits on the option after the chosen one.
  // Switching keeps the selected commit when the new range has it.
  const next = options[(options.findIndex(option => option.mode === snap.range) + 1) % options.length]?.mode
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
      <Text dimColor>Commits  </Text>
      {options.map(option => (
        <Button
          key={`range-${option.mode}`}
          {...(option.mode === next ? { hotkey: 'h' } : {})}
          variant={snap.range === option.mode ? 'primary' : undefined}
          dimColor={snap.range !== option.mode}
          onPress={() => void f.act.load('commit', { range: option.mode })}
        >
          {option.label}
        </Button>
      ))}
    </Box>
  )
}
