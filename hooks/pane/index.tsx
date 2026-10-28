// The pane, one screen at a time: no repository, still reading, nothing to
// walk (the welcome screen), or the walk itself.

import type { ElementTable } from 'claude-code'

import { printable } from '../printable'
import { commitSection, worktreePicker } from './commits'
import { debugButton, debugSection } from './debug'
import { fileSection } from './files'
import type { Frame } from './frame'
import { header } from './header'
import { rangeRow } from './ranges'
import { contentView, viewButtons } from './view'
import { chooseArt, welcomeArt } from './welcome'

export function drawPane(f: Frame) {
  const { Box, Text, Button } = f.ui
  const { snap } = f

  if (snap.repoRoot === null) {
    const art = chooseArt(f)
    if (snap.error) {
      return (
        <Box flexDirection="column" gap={1}>
          {welcomeArt(f, art.source)}
          <Text bold>No repository to review</Text>
          <Text color="red">{snap.error}</Text>
          <Text dimColor>Start Claude Code inside a Git repository, then run /commit-walk.</Text>
          <Box flexDirection="row" gap={1}>
            <Button key="refresh" hotkey="r" onPress={() => void f.act.load('repo')}>Try again</Button>
            {debugButton(f)}
          </Box>
          {debugSection(f, art.tier)}
        </Box>
      )
    }
    return (
      <Box flexDirection="column" gap={1}>
        {welcomeArt(f, art.source)}
        <Text dimColor>Reading the repository…</Text>
        {debugSection(f, art.tier)}
      </Box>
    )
  }

  // Uncommitted work is walked even where the range holds no commits (on the default branch, before the first commit).
  if (snap.commits.length === 0 && snap.uncommitted.length === 0) return nothingToWalk(f, snap.repoRoot)

  // The debug section sits under the header here: below the diff it would be off screen.
  return (
    <Box flexDirection="column" gap={1}>
      {header(f, snap.repoRoot)}
      {debugSection(f, null)}
      {worktreePicker(f)}
      {commitSection(f)}
      {fileSection(f)}
      {viewButtons(f)}
      {contentView(f)}
      <Text dimColor wrap="truncate-end">keys: o/n commit · f branch start · k/j file · d/a/b view · h range · r refresh · x debug · Esc close</Text>
    </Box>
  )
}

/** When drawing the pane threw: what failed and what to do, instead of a blank pane. */
export function drawFailure(ui: ElementTable, message: string) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Commit walk could not draw this view</Text>
      <Text>
        Something went wrong inside commit-walk, not in your repository. Run /commit-walk refresh to try again, or
        press Esc to close the pane.
      </Text>
      <Text dimColor>If it keeps happening, please report it with the detail below: github.com/mahdava/commit-walk/issues</Text>
      <Text color="red">{`Detail: ${printable(message)}`}</Text>
    </Box>
  )
}

/**
 * Nothing to walk: the welcome art, until a commit lands. Under "not in
 * default" that is the default branch itself (no work happens there) or a
 * branch level with it; otherwise a worktree with no commits at all.
 */
function nothingToWalk(f: Frame, repoRoot: string) {
  const { Box, Text, Button } = f.ui
  const { snap, sel } = f
  const worktree = snap.worktrees.find(wt => wt.path === sel.worktree)
  const where = worktree?.branch ?? 'this worktree'
  const defaultRef = snap.ranges.notInDefault?.ref ?? 'the default branch'
  const isNotInDefault = snap.range === 'notInDefault'
  const art = chooseArt(f)
  const showAll = (
    <Box>
      <Button key="show-all" onPress={() => void f.act.load('commit', { range: 'all', commit: null, file: null })}>
        Show all commits
      </Button>
    </Box>
  )
  return (
    <Box flexDirection="column" gap={1}>
      {header(f, repoRoot)}
      {debugSection(f, art.tier)}
      {worktreePicker(f)}
      {rangeRow(f)}
      {welcomeArt(f, art.source)}
      {isNotInDefault && snap.ranges.isOnDefault ? (
        <Box flexDirection="column" gap={1}>
          <Text>You're on {where}. Work happens on branches, so there is nothing new to walk here.</Text>
          <Text dimColor>Pick a worktree above, or show the whole history.</Text>
          {showAll}
        </Box>
      ) : isNotInDefault ? (
        <Box flexDirection="column" gap={1}>
          <Text>No commits on {where} beyond {defaultRef} yet.</Text>
          <Text dimColor>The pane follows the first one as soon as it lands. Press r to look again.</Text>
          {showAll}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text>No commits on {where} yet.</Text>
          <Text dimColor>The pane follows the first one as soon as it lands. Press r to look again.</Text>
        </Box>
      )}
    </Box>
  )
}
