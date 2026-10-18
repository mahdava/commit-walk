// How the selected file reads: Diff, After or Before, and the code itself.

import type { ViewMode } from '../../types'
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
  if (content.kind === 'note') return <Text dimColor>{content.text}</Text>
  return (
    <Box flexDirection="column">
      {content.kind === 'diff' && content.context === 'near' ? (
        <Text dimColor>Too large for the whole file: showing the changes with 20 lines of context.</Text>
      ) : null}
      {content.kind === 'diff' ? (
        <Code source={content.source} format="diff" path={f.snap.files.find(one => one.path === f.sel.file)?.path} />
      ) : (
        <Code source={content.source} path={content.path} startLine={1} />
      )}
      {content.isTruncated ? <Text dimColor>Cut here to fit the pane; open the file to read the rest.</Text> : null}
    </Box>
  )
}
