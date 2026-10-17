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

/** Which commits the list starts from. */
export type RangeMode = 'all' | 'notInDefault' | 'base'

/** A narrower range: commits of HEAD not reachable from `ref`. */
export type Range = { ref: string; count: number }

/** The ranges a worktree offers besides its whole history. */
export type Ranges = {
  branch: string | null
  notInDefault: Range | null
  base: Range | null
}

/** Where the person is: chosen by identity, so a refresh keeps the place. */
export type Selection = {
  worktree: string | null
  commit: string | null
  file: string | null
  mode: ViewMode
  /** True while the newest commit is selected: a refresh then moves to the new newest. */
  isFollowing: boolean
  /**
   * Which commits the person wants the list to start from: "not in default"
   * until they pick another. A worktree that does not offer it shows all
   * commits instead (Snapshot.range), and the preference is kept for the next.
   */
  range: RangeMode
}

/** The lists that fold open under their row. */
export type Expandable = 'worktree' | 'commit'

/** One git command the pane ran, for the debug section. */
export type GitTrace = {
  args: string
  cwd: string
  exitCode: number
  ms: number
  /** The first line of stderr when the command failed. */
  error: string | null
}

/** What the debug section says about where the pane runs. */
export type About = {
  pluginVersion: string | null
  engineVersion: string | null
  cwd: string
}

/** Everything loaded for the current selection. */
export type Snapshot = {
  repoRoot: string | null
  worktrees: Worktree[]
  commits: Commit[]
  /** The ranges the selected worktree offers. */
  ranges: Ranges
  /** The range the list shows: the preferred one, or all where the worktree does not offer it. */
  range: RangeMode
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
      /** Which list is unfolded below its row, if any. */
      expanded: Expandable | null
      /** Whether the debug section is shown. */
      debug: boolean
      /** The last git commands, oldest first. */
      trace: GitTrace[]
      about: About
      /** Where a list is scrolled to, by list: the index of its first drawn row. */
      scroll: Record<string, { start: number; anchor: string | null }>
    }
  }
}
