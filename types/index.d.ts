// The commit-walk mod's state contract: what the pane draws from, held by
// the host for the session so a hot reload keeps the person's place.

/** How the selected file is shown. */
export type ViewMode = 'diff' | 'after' | 'before'

export type Worktree = {
  path: string
  head: string
  /** The branch name, or null when HEAD is detached. */
  branch: string | null
  isLocked: boolean
}

export type Commit = {
  sha: string
  shortSha: string
  /** Every parent; more than one means a merge, shown against the first. */
  parents: string[]
  author: string
  /** Git's relative date, e.g. "3 hours ago". */
  when: string
  subject: string
}

/** One letter of git's name-status: A, M, D, R, C, T, U. */
export type FileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U'

export type ChangedFile = {
  status: FileStatus
  path: string
  /** The path before a rename or copy. */
  oldPath: string | null
  isBinary: boolean
  added: number
  deleted: number
}

/** What the code area shows. */
export type Content =
  | { kind: 'diff'; source: string; isTruncated: boolean; context: 'full' | 'near' }
  | { kind: 'file'; source: string; isTruncated: boolean; path: string }
  | { kind: 'note'; text: string }

/** Where the person is: chosen by identity, so a refresh keeps the place. */
export type Selection = {
  worktree: string | null
  commit: string | null
  file: string | null
  mode: ViewMode
  /** True while the newest commit is selected: a refresh then moves to the new newest. */
  isFollowing: boolean
}

/** Everything loaded for the current selection. */
export type Snapshot = {
  repoRoot: string | null
  worktrees: Worktree[]
  commits: Commit[]
  files: ChangedFile[]
  content: Content | null
  isLoading: boolean
  error: string | null
  /** When the snapshot was last loaded, epoch milliseconds. */
  loadedAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'commit-walk': {
      selection: Selection
      snapshot: Snapshot
    }
  }
}
