// The top of the pane: the repository's name, Refresh and Debug, and whether
// the pane follows the newest commit.

import { baseName, clip } from '../labels'
import { TONE_COLOR } from '../welcome'
import { debugButton } from './debug'
import type { Frame } from './frame'

export function header(f: Frame, repoRoot: string) {
  const { Box, Text, Button } = f.ui
  const { sel, snap } = f
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text bold>
          <Text color={TONE_COLOR.petal}>✿</Text> {clip(baseName(repoRoot), f.width - 16)}
        </Text>
        <Button key="refresh" hotkey="r" onPress={() => void f.act.load('repo')}>Refresh</Button>
        {debugButton(f)}
      </Box>
      <Text dimColor wrap="truncate-end">{snap.isLoading ? 'Loading…' : sel.isFollowing ? 'Following the newest commit' : 'Pinned to a past commit'}</Text>
      {snap.error ? <Text color="red">{snap.error}</Text> : null}
    </Box>
  )
}
