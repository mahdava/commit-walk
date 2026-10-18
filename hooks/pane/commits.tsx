// The worktree and the commit: each a foldable list, the commit with its
// author, date and position, and Older and Newer.

import { commitLabel, worktreeLabel } from '../labels'
import type { Frame } from './frame'
import { foldable } from './list'
import { rangeRow } from './ranges'

export function worktreePicker(f: Frame) {
  const { snap, sel } = f
  const worktree = snap.worktrees.find(wt => wt.path === sel.worktree)
  return foldable(f, {
    which: 'worktree',
    prefix: 'worktree',
    label: 'Worktree  ',
    current: worktree ? worktreeLabel(worktree) : 'none',
    items: snap.worktrees,
    at: snap.worktrees.findIndex(wt => wt.path === worktree?.path),
    keyOf: wt => wt.path,
    textOf: worktreeLabel,
    noun: { one: 'worktree', many: 'worktrees' },
    onPick: wt => void f.act.load('repo', { worktree: wt.path, commit: null, file: null }),
  })
}

export function commitSection(f: Frame) {
  const { Box, Text, Button } = f.ui
  const { snap, sel } = f
  const at = snap.commits.findIndex(one => one.sha === sel.commit)
  const commit = snap.commits[at]
  return (
    <Box flexDirection="column">
      {rangeRow(f)}
      {foldable(f, {
        which: 'commit',
        prefix: 'commit',
        label: 'Commit    ',
        current: commit ? commitLabel(commit) : 'none',
        items: snap.commits,
        at,
        keyOf: one => one.sha,
        textOf: commitLabel,
        noun: { one: 'commit', many: 'commits' },
        onPick: one => void f.act.load('commit', { commit: one.sha, file: null }),
      })}
      {commit ? (
        <Text dimColor wrap="truncate-end">
          {commit.author} · {commit.when}
          {commit.parents.length > 1 ? ' · merge, against its first parent' : ''}
          {commit.parents.length === 0 ? ' · root commit' : ''}
          {` · ${at + 1} of ${snap.commits.length}`}
        </Text>
      ) : null}
      <Box flexDirection="row" gap={1}>
        <Button key="older" hotkey="o" dimColor={at >= snap.commits.length - 1} onPress={() => void f.act.stepCommit(1)}>Older</Button>
        <Button key="newer" hotkey="n" dimColor={at <= 0} onPress={() => void f.act.stepCommit(-1)}>Newer</Button>
      </Box>
    </Box>
  )
}
