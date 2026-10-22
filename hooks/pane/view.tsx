// How the selected file reads: Diff, After or Before, and the code itself;
// for uncommitted work, under a label saying whether it is staged.

import type { ViewMode } from '../../types'
import { stageLabel } from '../labels'
import { hasHidden } from '../printable'
import { UNCOMMITTED } from '../state'
import { TONE_COLOR } from '../welcome'
import type { Frame } from './frame'

export function viewButtons(f: Frame) {
  const { Box, Button } = f.ui
  const mode = (key: ViewMode, label: string, hotkey: string) => (
    <Button key={`mode-${key}`} hotkey={hotkey} variant={f.sel.mode === key ? 'primary' : undefined} onPress={() => void f.act.load('content', { mode: key })}>
      {label}
    </Button>
  )
  return (
    <Box flexDirection="row" gap={1}>
      {mode('diff', 'Diff', 'd')}
      {mode('after', 'After', 'a')}
      {mode('before', 'Before', 'b')}
    </Box>
  )
}

export function contentView(f: Frame) {
  const { Box, Text, Code } = f.ui
  const content = f.snap.content
  if (content === null) return null
  const file = f.snap.files.find(one => one.path === f.sel.file)
  // Uncommitted work is labelled above the code: which part a diff shows, or what a file holds.
  const banner = (label: string, key: string) => (
    <Text key={key} bold>
      <Text color={TONE_COLOR.petal}>✿</Text> {label}
    </Text>
  )
  const label = f.sel.commit === UNCOMMITTED && file?.xy ? banner(stageLabel(file.xy), 'stage') : null
  if (content.kind === 'note') {
    return (
      <Box flexDirection="column">
        {label}
        <Text dimColor>{content.text}</Text>
      </Box>
    )
  }
  if (content.kind === 'parts') {
    const sources = content.parts.map(part => part.source)
    return (
      <Box flexDirection="column">
        {content.parts.map(part => (
          <Box key={`part-${part.stage}`} flexDirection="column">
            {banner(part.stage === 'staged' ? 'Staged changes' : 'Unstaged changes', `stage-${part.stage}`)}
            {part.context === 'near' ? <Text dimColor>Too large for the whole file: showing the changes with 20 lines of context.</Text> : null}
            <Code source={part.source} format="diff" path={file?.path} />
            {part.isTruncated ? <Text dimColor>Cut here to fit the pane; open the file to read the rest.</Text> : null}
          </Box>
        ))}
        {sources.some(hasHidden) ? hiddenNote(f) : null}
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      {label}
      {content.kind === 'diff' && content.context === 'near' ? (
        <Text dimColor>Too large for the whole file: showing the changes with 20 lines of context.</Text>
      ) : null}
      {content.kind === 'diff' ? (
        <Code source={content.source} format="diff" path={file?.path} />
      ) : (
        <Code source={content.source} path={content.path} startLine={1} />
      )}
      {content.isTruncated ? <Text dimColor>Cut here to fit the pane; open the file to read the rest.</Text> : null}
      {hasHidden(content.source) ? hiddenNote(f) : null}
    </Box>
  )
}

function hiddenNote(f: Frame) {
  const { Text } = f.ui
  return <Text dimColor>This file holds hidden characters, shown as symbols: ␛ for ESC, ⟨RLO⟩ for a right-to-left override.</Text>
}
