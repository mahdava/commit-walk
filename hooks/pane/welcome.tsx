// The welcome art: the sunflower over a commit line, centred, the largest
// that fits the pane with room for the message under it, else a one-line mark.

import { COMMIT_LINE, DIM_TONES, LARGE, MEDIUM, SMALL, SMALL_LINE, TONE_COLOR, artRuns, type Art } from '../welcome'
import type { Frame } from './frame'

/** The art that fits, and its name for the debug section. */
export function chooseArt(f: Frame): { source: Art | null; tier: string } {
  const rows = f.place.bodyRows
  const fits = (art: Art, roomBelow: number) => f.width >= art.width + 2 && rows >= art.rows.length + roomBelow
  // The small one needs a single spare column, so it fits even the narrowest (24-column) pane.
  const source = fits(LARGE, 10) ? LARGE : fits(MEDIUM, 10) ? MEDIUM : f.width >= SMALL.width + 1 ? SMALL : null
  const tier = source === LARGE ? 'large' : source === MEDIUM ? 'medium' : source === SMALL ? 'small' : 'one-line mark'
  return { source, tier }
}

export function welcomeArt(f: Frame, source: Art | null) {
  const { Box, Text } = f.ui
  if (source === null) {
    return (
      <Text bold color={TONE_COLOR.leaf}>
        <Text color={TONE_COLOR.petal}>✿</Text> Commit Walk
      </Text>
    )
  }
  const centred = (art: Art, row: number, key: string) => (
    <Text key={key} wrap="truncate-end">
      {' '.repeat(Math.max(0, Math.floor((f.width - art.width) / 2)))}
      {artRuns(art, row).map((run, i) =>
        run.tone === null && run.color === undefined ? (
          run.text
        ) : (
          <Text key={`r${i}`} color={run.color ?? (run.tone ? TONE_COLOR[run.tone] : undefined)} dimColor={run.tone ? DIM_TONES.has(run.tone) : false}>
            {run.text}
          </Text>
        ),
      )}
    </Text>
  )
  const title = 'Commit Walk'
  return (
    <Box flexDirection="column">
      {source.rows.map((_, row) => centred(source, row, `art-${row}`))}
      {centred(source === SMALL ? SMALL_LINE : COMMIT_LINE, 0, 'art-line')}
      <Text> </Text>
      <Text bold color={TONE_COLOR.leaf}>
        {' '.repeat(Math.max(0, Math.floor((f.width - title.length) / 2)))}
        {title}
      </Text>
    </Box>
  )
}
