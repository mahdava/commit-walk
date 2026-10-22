// How worktrees, commits and files read as one line of text.

import type { ChangedFile, Commit, Worktree } from '../types'

/** `text`, cut to `width` with an ellipsis; never narrower than 8. */
export function clip(text: string, width: number): string {
  const room = Math.max(8, width)
  return text.length <= room ? text : `${text.slice(0, room - 1)}…`
}

export function baseName(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() ?? path
}

export function worktreeLabel(wt: Worktree): string {
  const ref = wt.branch ?? `detached @ ${wt.head.slice(0, 7)}`
  return `${ref}  ·  ${baseName(wt.path)}${wt.isLocked ? '  (locked)' : ''}`
}

export function commitLabel(commit: Commit): string {
  return `${commit.shortSha}  ${commit.subject}`
}

/** `3 files`, `1 file`. */
export function fileCount(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`
}

/** The uncommitted changes' row in the commit list, above the newest commit. */
export function uncommittedLabel(count: number): string {
  return `✿ Uncommitted changes · ${fileCount(count)}`
}

/** What the label above an uncommitted file's code says it shows, from git's two-letter status. */
export function stageLabel(xy: string): string {
  if (xy === '??' || xy.charAt(0) === ' ') return 'Unstaged changes'
  if (xy.charAt(1) === ' ') return 'Staged changes'
  return 'Staged and unstaged changes'
}

/** A file's path, or `old → new` for a rename. */
export function fileName(file: ChangedFile): string {
  return file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path
}

/** A file's row: its name and line counts, "binary", or "new file" for an untracked file not counted. */
export function fileText(file: ChangedFile): string {
  const counts = file.isBinary ? 'binary' : file.isUncounted ? 'new file' : `+${file.added} −${file.deleted}`
  return `${fileName(file)}  ${counts}`
}
