// The debug section: where the pane runs, what it holds, the last git
// commands. Drawn on every screen while it is on.

import type { Frame } from './frame'

export function debugButton(f: Frame) {
  const { Button } = f.ui
  return (
    <Button key="debug" hotkey="x" dimColor onPress={() => void f.act.toggleDebug()}>
      {f.isDebug ? 'Hide debug' : 'Debug'}
    </Button>
  )
}

/** The section itself, or nothing while it is off. `artTier`: the welcome art on screen, if any. */
export function debugSection(f: Frame, artTier: string | null) {
  const { Box, Text } = f.ui
  const { sel, snap, open, gitRuns, where } = f
  if (!f.isDebug || where === null) return null
  const line = (text: string, key: string) => <Text key={key} dimColor wrap="truncate-end">{text}</Text>
  const counts = `${snap.worktrees.length} worktrees · ${snap.commits.length} commits · ${snap.files.length} files`
  const age = snap.loadedAt === null ? 'never loaded' : `loaded ${Math.round((Date.now() - snap.loadedAt) / 1000)}s ago`
  return (
    <Box flexDirection="column" borderStyle="single" borderDimColor>
      <Text bold dimColor>Debug</Text>
      {line(`commit-walk ${where.pluginVersion ?? '?'} · Claude Code ${where.engineVersion ?? 'unknown (before 2.1.300)'} · ${f.place.surface}`, 'd-versions')}
      {line(`pane ${f.place.bodyColumns}×${f.place.bodyRows} ${f.place.placement}${artTier ? ` · welcome art: ${artTier}` : ''}`, 'd-pane')}
      {line(`cwd ${where.cwd}`, 'd-cwd')}
      {line(`repo ${snap.repoRoot ?? 'none'}`, 'd-repo')}
      {line(`worktree ${sel.worktree ?? '-'} · commit ${sel.commit?.slice(0, 7) ?? '-'} · file ${sel.file ?? '-'}`, 'd-sel')}
      {line(`view ${sel.mode} · ${sel.isFollowing ? 'following' : 'pinned'} · open list ${open ?? 'none'}`, 'd-view')}
      {line(`range shown ${snap.range} · preferred ${sel.range}`, 'd-range')}
      {line(`${counts} · ${age}${snap.isLoading ? ' · loading' : ''}`, 'd-counts')}
      {snap.error ? <Text key="d-error" color="red" wrap="truncate-end">error {snap.error}</Text> : null}
      {line(gitRuns.length === 0 ? 'git: nothing run yet' : `git, last ${gitRuns.length}, newest last:`, 'd-git')}
      {gitRuns.map((run, i) => (
        <Text key={`d-git-${i}`} color={run.exitCode === 0 ? undefined : 'red'} dimColor={run.exitCode === 0} wrap="truncate-end">
          {`  ${String(run.exitCode).padStart(3)} ${String(run.ms).padStart(5)}ms  ${run.args}${run.error ? `  · ${run.error}` : ''}`}
        </Text>
      ))}
    </Box>
  )
}
