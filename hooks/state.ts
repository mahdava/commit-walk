// The pane's constants and the first values of what the host keeps for it.
//
// The atoms themselves are declared in register.tsx, the one file that reads
// and writes them: Claude Code requires an atom read or written in a file to
// be declared in that same file, so it can list what each module touches.

import type { Selection, Snapshot } from '../types'

/**
 * How much to load again: `repo` re-reads worktrees and commits (open,
 * refresh, another worktree); `commit` the changed files; `content` the code
 * area alone (another file or view).
 */
export type Depth = 'repo' | 'commit' | 'content'

export const PANE = 'commit-walk'
export const TITLE = 'Commit walk'
/** Width the dock asks for beside a fullscreen transcript. */
export const PANE_COLUMNS = 84
/** Debounce for refreshes after edits and turns. */
export const REFRESH_DELAY_MS = 400
/** Rows a list shows at once; more page with its edge rows. */
export const LIST_ROWS = 8
export const GIT_TIMEOUT_MS = 20_000
/** Git commands the debug section keeps. */
export const TRACE_LENGTH = 10
/** Tools whose successful, non-read-only calls may have changed the repository. */
export const WRITING_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'Bash'] as const

export const INITIAL_SELECTION: Selection = { worktree: null, commit: null, file: null, mode: 'diff', isFollowing: true, range: 'notInDefault' }
export const EMPTY_SNAPSHOT: Snapshot = {
  repoRoot: null,
  worktrees: [],
  commits: [],
  ranges: { branch: null, isOnDefault: false, notInDefault: null, base: null },
  range: 'all',
  files: [],
  content: null,
  isLoading: false,
  error: null,
  loadedAt: null,
}
