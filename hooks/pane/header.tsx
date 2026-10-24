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
        {/* The name gives way to the buttons: in a narrow pane it is cut with … rather than wrapped mid-word. */}
        <Box flexShrink={1} minWidth={0}>
          <Text bold wrap="truncate-end">
            <Text color={TONE_COLOR.petal}>✿</Text> {clip(baseName(repoRoot), f.width - 16)}
          </Text>
        </Box>
        <Box flexShrink={0} flexDirection="row" gap={1}>
          <Button key="refresh" hotkey="r" onPress={() => void f.act.load('repo')}>Refresh</Button>
          {debugButton(f)}
        </Box>
      </Box>
      <Text dimColor wrap="truncate-end">{snap.isLoading ? 'Loading…' : sel.isFollowing ? 'Following the newest commit' : 'Pinned to a past commit'}</Text>
      {snap.error ? <Text color="red">{snap.error}</Text> : null}
    </Box>
  )
}
