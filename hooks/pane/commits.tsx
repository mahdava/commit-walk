// The worktree and the commit: each a foldable list, the commit with its
// author, date and position (counted from the oldest), and Older and Newer. The uncommitted changes
// are the list's first row and the step after the newest commit.

import type { Commit } from '../../types'
import { commitLabel, fileCount, uncommittedLabel, worktreeLabel } from '../labels'
import { UNCOMMITTED } from '../state'
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

/** A row of the commit list: a commit, or the uncommitted changes. */
type Row = Commit | typeof UNCOMMITTED

export function commitSection(f: Frame) {
  const { Box, Text, Button } = f.ui
  const { snap, sel } = f
  const isUncommitted = sel.commit === UNCOMMITTED
  const pending = snap.uncommitted.length
  // The rows: the uncommitted changes first while there are any, then the commits, newest first.
  const rows: Row[] = [...(pending > 0 ? [UNCOMMITTED as Row] : []), ...snap.commits]
  const at = snap.commits.findIndex(one => one.sha === sel.commit)
  const commit = snap.commits[at]
  const keyOf = (row: Row) => (row === UNCOMMITTED ? UNCOMMITTED : row.sha)
  const textOf = (row: Row) => (row === UNCOMMITTED ? uncommittedLabel(pending) : commitLabel(row))
  // From the newest commit, Newer steps to the uncommitted changes, and says so.
  const isNewest = at === 0
  const newerLabel = isNewest && pending > 0 ? 'Uncommitted' : 'Newer'
  return (
    <Box flexDirection="column">
      {rangeRow(f)}
      {foldable(f, {
        which: 'commit',
        prefix: 'commit',
        label: 'Commit    ',
        current: isUncommitted ? textOf(UNCOMMITTED) : commit ? commitLabel(commit) : 'none',
        items: rows,
        at: rows.findIndex(row => keyOf(row) === sel.commit),
        keyOf,
        textOf,
        noun: { one: 'commit', many: 'commits' },
        onPick: row => void f.act.load('commit', { commit: keyOf(row), file: null }),
      })}
      {isUncommitted ? (
        <Text dimColor wrap="truncate-end">{`Not committed yet · ${fileCount(pending)}`}</Text>
      ) : commit ? (
        <Text dimColor wrap="truncate-end">
          {commit.author} · {commit.when}
          {commit.parents.length > 1 ? ' · merge, against its first parent' : ''}
          {commit.parents.length === 0 ? ' · root commit' : ''}
          {/* Counted from the oldest: the newest is "6 of 6". */}
          {` · ${snap.commits.length - at} of ${snap.commits.length}`}
        </Text>
      ) : null}
      <Box flexDirection="row" gap={1}>
        <Button key="older" hotkey="o" dimColor={isUncommitted ? snap.commits.length === 0 : at >= snap.commits.length - 1} onPress={() => void f.act.stepCommit(1)}>Older</Button>
        <Button key="newer" hotkey="n" dimColor={isUncommitted || (isNewest && pending === 0) || at < 0} onPress={() => void f.act.stepCommit(-1)}>{newerLabel}</Button>
      </Box>
    </Box>
  )
}
