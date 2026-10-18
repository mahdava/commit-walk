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

/** A file's path, or `old → new` for a rename. */
export function fileName(file: ChangedFile): string {
  return file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path
}

/** A file's row: its name and line counts, or "binary". */
export function fileText(file: ChangedFile): string {
  return `${fileName(file)}  ${file.isBinary ? 'binary' : `+${file.added} −${file.deleted}`}`
}
