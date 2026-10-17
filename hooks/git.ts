// Git for the commit-walk pane: the commands it runs and the parsers for
// their output. No engine calls here: `createRepo` takes the runner, so the
// tests drive it with canned git output.

import type { ChangedFile, Commit, Content, FileStatus, Ranges, Worktree } from '../types'

/** What one git run answers (the shape of `$.process.run`'s result). */
export type GitRun = { exitCode: number; stdout: string; stderr: string; isStdoutTruncated?: boolean }

/** Runs `git <args>` in `cwd`. */
export type GitRunner = (cwd: string, args: readonly string[]) => Promise<GitRun>

/** The most characters the code area is handed: the drawing holds 100,000 in all. */
export const SOURCE_BUDGET = 60_000
/** Commits listed per worktree. */
export const MAX_COMMITS = 100
/** Context lines when a full-file diff does not fit the budget. */
const NEAR_CONTEXT = 20
/** A blob larger than this is not read into the pane. */
const MAX_BLOB_BYTES = 4_000_000

const FIELD = '\x1f'
const LOG_FORMAT = ['%H', '%h', '%P', '%an', '%ar', '%s'].join('%x1f')
const STATUSES = new Set<FileStatus>(['A', 'M', 'D', 'R', 'C', 'T', 'U'])

export class GitError extends Error {
  constructor(args: readonly string[], run: GitRun) {
    const why = run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`
    super(`git ${args[0] ?? ''}: ${why}`)
    this.name = 'GitError'
  }
}

// ── Parsers ──────────────────────────────────────────────────────────────

/** `git worktree list --porcelain -z`: NUL-ended lines, an empty one between records. */
export function parseWorktrees(text: string): Worktree[] {
  const out: Worktree[] = []
  let record: string[] = []
  const flush = () => {
    const path = record.find(line => line.startsWith('worktree '))?.slice(9)
    const isBare = record.includes('bare')
    const isPrunable = record.some(line => line === 'prunable' || line.startsWith('prunable '))
    if (path && !isBare && !isPrunable) {
      const ref = record.find(line => line.startsWith('branch '))?.slice(7)
      out.push({
        path,
        head: record.find(line => line.startsWith('HEAD '))?.slice(5) ?? '',
        branch: ref ? ref.replace(/^refs\/heads\//, '') : null,
        isLocked: record.some(line => line === 'locked' || line.startsWith('locked ')),
      })
    }
    record = []
  }
  for (const line of text.split('\0')) {
    if (line === '') flush()
    else record.push(line)
  }
  flush()
  return out
}

/** `git log -z --format=LOG_FORMAT`: NUL between commits, 0x1f between fields. */
export function parseLog(text: string): Commit[] {
  return text
    .split('\0')
    .map(record => record.replace(/^\n+|\n+$/g, ''))
    .filter(record => record !== '')
    .map(record => {
      const [sha = '', shortSha = '', parents = '', author = '', when = '', ...subject] = record.split(FIELD)
      return {
        sha,
        shortSha,
        parents: parents.split(' ').filter(Boolean),
        author,
        when,
        subject: subject.join(FIELD),
      }
    })
    .filter(commit => /^[0-9a-f]{7,64}$/.test(commit.sha))
}

type NameStatus = { status: FileStatus; path: string; oldPath: string | null }

/** `git diff-tree -z --name-status`: a status token, then one path (two for R and C). */
export function parseNameStatus(text: string): NameStatus[] {
  const tokens = text.split('\0')
  const out: NameStatus[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? ''
    const letter = token.charAt(0) as FileStatus
    if (!STATUSES.has(letter)) continue
    if (letter === 'R' || letter === 'C') {
      const from = tokens[i + 1] ?? ''
      const to = tokens[i + 2] ?? ''
      i += 2
      if (to !== '') out.push({ status: letter, path: to, oldPath: from })
    } else {
      const path = tokens[i + 1] ?? ''
      i += 1
      if (path !== '') out.push({ status: letter, path, oldPath: null })
    }
  }
  return out
}

type NumStat = { path: string; added: number; deleted: number; isBinary: boolean }

/** `git diff-tree -z --numstat`: `a\td\tpath`, or `a\td\t` then old and new paths for a rename. */
export function parseNumstat(text: string): NumStat[] {
  const tokens = text.split('\0')
  const out: NumStat[] = []
  for (let i = 0; i < tokens.length; i++) {
    const match = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(tokens[i] ?? '')
    if (!match) continue
    const [, added = '', deleted = '', inline = ''] = match
    let path = inline
    if (inline === '') {
      path = tokens[i + 2] ?? ''
      i += 2
    }
    const isBinary = added === '-' && deleted === '-'
    out.push({ path, added: isBinary ? 0 : Number(added), deleted: isBinary ? 0 : Number(deleted), isBinary })
  }
  return out
}

/** Joins name-status and numstat rows by path. */
export function joinChanges(names: NameStatus[], stats: NumStat[]): ChangedFile[] {
  const byPath = new Map(stats.map(stat => [stat.path, stat]))
  return names.map(name => {
    const stat = byPath.get(name.path)
    return {
      ...name,
      isBinary: stat?.isBinary ?? false,
      added: stat?.added ?? 0,
      deleted: stat?.deleted ?? 0,
    }
  })
}

// ── Fitting text into the pane ───────────────────────────────────────────

/** The hunks of a one-file patch: everything from the first `@@` line on. */
export function hunksOf(patch: string): string {
  const lines = patch.split('\n')
  const first = lines.findIndex(line => line.startsWith('@@'))
  return first < 0 ? '' : lines.slice(first).join('\n').replace(/\n+$/, '')
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

/**
 * Keeps whole lines of `hunks` up to `budget` characters. A hunk cut short
 * gets a header counting the lines kept, so it still parses as a hunk.
 */
export function fitHunks(hunks: string, budget = SOURCE_BUDGET): { source: string; isTruncated: boolean } {
  if (hunks.length <= budget) return { source: hunks, isTruncated: false }
  const lines = hunks.split('\n')
  const kept: string[] = []
  let used = 0
  let header = -1
  let oldCount = 0
  let newCount = 0
  for (const line of lines) {
    if (used + line.length + 1 > budget) break
    if (line.startsWith('@@')) {
      header = kept.length
      oldCount = 0
      newCount = 0
    } else if (line.startsWith('-')) oldCount++
    else if (line.startsWith('+')) newCount++
    else if (line.startsWith(' ')) {
      oldCount++
      newCount++
    }
    kept.push(line)
    used += line.length + 1
  }
  if (header >= 0) {
    const match = HUNK.exec(kept[header] ?? '')
    if (match) {
      const [, oldStart = '1', newStart = '1', rest = ''] = match
      kept[header] = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${rest}`
    }
  }
  while (kept.length > 0 && (kept[kept.length - 1] ?? '').startsWith('@@')) kept.pop()
  return { source: kept.join('\n'), isTruncated: true }
}

/** Keeps whole lines of `text` up to `budget` characters. */
export function fitText(text: string, budget = SOURCE_BUDGET): { source: string; isTruncated: boolean } {
  const trimmed = text.replace(/\n+$/, '')
  if (trimmed.length <= budget) return { source: trimmed, isTruncated: false }
  const cut = trimmed.lastIndexOf('\n', budget)
  return { source: trimmed.slice(0, cut > 0 ? cut : budget), isTruncated: true }
}

// ── The repository ───────────────────────────────────────────────────────

export function createRepo(run: GitRunner) {
  const emptyTrees = new Map<string, string>()

  async function git(cwd: string, args: readonly string[]): Promise<GitRun> {
    const result = await run(cwd, args)
    if (result.exitCode !== 0) throw new GitError(args, result)
    return result
  }

  /** The tree a root commit is compared with: git's empty tree, in this repo's hash. */
  async function emptyTree(cwd: string): Promise<string> {
    const known = emptyTrees.get(cwd)
    if (known) return known
    const sha = (await git(cwd, ['hash-object', '-t', 'tree', '/dev/null'])).stdout.trim()
    emptyTrees.set(cwd, sha)
    return sha
  }

  async function baseOf(cwd: string, commit: Commit): Promise<string> {
    return commit.parents[0] ?? (await emptyTree(cwd))
  }

  /** Reads one blob as text, or says why it is not shown. */
  async function blob(cwd: string, rev: string, path: string): Promise<Content> {
    const spec = `${rev}:${path}`
    const size = Number((await git(cwd, ['cat-file', '-s', spec])).stdout.trim())
    if (size > MAX_BLOB_BYTES) {
      return { kind: 'note', text: `${path} is ${Math.round(size / 1_000_000)} MB; too large to show here.` }
    }
    const result = await git(cwd, ['cat-file', 'blob', spec])
    if (result.stdout.slice(0, 8000).includes('\0')) return { kind: 'note', text: 'Binary file: no text to show.' }
    const fitted = fitText(result.stdout)
    return { kind: 'file', path, source: fitted.source, isTruncated: fitted.isTruncated || result.isStdoutTruncated === true }
  }

  return {
    async toplevel(cwd: string): Promise<string> {
      return (await git(cwd, ['rev-parse', '--show-toplevel'])).stdout.trim()
    },

    async worktrees(root: string): Promise<Worktree[]> {
      return parseWorktrees((await git(root, ['worktree', 'list', '--porcelain', '-z'])).stdout)
    },

    /**
     * The ranges a worktree can start its commit list from: the default branch
     * (origin's HEAD, else main or master, local before origin's) and the base branch, the
     * nearest other local branch HEAD grew from. Each with the number of
     * HEAD's commits it does not have; null where there is none.
     */
    async ranges(cwd: string): Promise<Ranges> {
      const branch = (await run(cwd, ['branch', '--show-current'])).stdout.trim() || null
      const exists = async (ref: string) => (await run(cwd, ['rev-parse', '--verify', '--quiet', ref])).exitCode === 0
      let defaultRef: string | null = null
      const originHead = await run(cwd, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
      if (originHead.exitCode === 0 && originHead.stdout.trim() !== '') defaultRef = originHead.stdout.trim()
      else {
        // No origin/HEAD (a clone that never set it): main or master, local before remote.
        for (const [ref, name] of [['refs/heads/main', 'main'], ['refs/heads/master', 'master'], ['refs/remotes/origin/main', 'origin/main'], ['refs/remotes/origin/master', 'origin/master']] as const) {
          if (await exists(ref)) {
            defaultRef = name
            break
          }
        }
      }

      const countSince = async (ref: string) => {
        const counted = await run(cwd, ['rev-list', '--count', `${ref}..HEAD`])
        return counted.exitCode === 0 ? Number(counted.stdout.trim()) : null
      }
      const defaultAhead = defaultRef ? await countSince(defaultRef) : null
      const defaultName = defaultRef?.replace(/^origin\//, '') ?? null
      // On the default branch itself, or level with it, there is nothing to narrow to.
      const notInDefault = defaultRef && defaultAhead && branch !== defaultName ? { ref: defaultRef, count: defaultAhead } : null

      // One command for every branch's distance (git 2.41+); older git offers no base.
      const listed = await run(cwd, ['for-each-ref', '--format=%(refname:short)%09%(ahead-behind:HEAD)', 'refs/heads'])
      let base: { ref: string; count: number } | null = null
      if (listed.exitCode === 0) {
        let best: { ref: string; mine: number; theirs: number } | null = null
        for (const line of listed.stdout.split('\n')) {
          const [ref = '', counts = ''] = line.split('\t')
          const [theirs, mine] = counts.split(' ').map(Number)
          // `mine`: HEAD's commits the branch lacks. 0 means it already holds HEAD (this branch, or one built on it).
          if (ref === '' || ref === branch || mine === undefined || theirs === undefined || !(mine > 0)) continue
          if (!best || mine < best.mine || (mine === best.mine && theirs < best.theirs)) best = { ref, mine, theirs }
        }
        // A base that is the default branch, or as far back as it, adds nothing to "not in default".
        if (best && best.ref !== defaultName && (defaultAhead === null || best.mine < defaultAhead)) {
          base = { ref: best.ref, count: best.mine }
        }
      }
      return { branch, notInDefault, base }
    },

    /** The commits of HEAD, newest first; with `since`, only those not reachable from it (`since..HEAD`). */
    async log(cwd: string, since: string | null = null): Promise<Commit[]> {
      const args = ['log', '-z', `--max-count=${MAX_COMMITS}`, `--format=${LOG_FORMAT}`, since ? `${since}..HEAD` : 'HEAD', '--']
      const result = await run(cwd, args)
      // A branch with no commits yet has nothing to list; anything else is an error.
      if (result.exitCode !== 0 && /does not have any commits|unknown revision/.test(result.stderr)) return []
      if (result.exitCode !== 0) throw new GitError(args, result)
      return parseLog(result.stdout)
    },

    async changes(cwd: string, commit: Commit): Promise<ChangedFile[]> {
      const base = await baseOf(cwd, commit)
      const common = ['diff-tree', '-r', '-M', '-z', '--no-ext-diff', base, commit.sha]
      const [names, stats] = await Promise.all([
        git(cwd, [...common, '--name-status']),
        git(cwd, [...common, '--numstat']),
      ])
      return joinChanges(parseNameStatus(names.stdout), parseNumstat(stats.stdout))
    },

    async diff(cwd: string, commit: Commit, file: ChangedFile): Promise<Content> {
      if (file.isBinary) return { kind: 'note', text: 'Binary file: no text diff.' }
      const base = await baseOf(cwd, commit)
      const paths = file.oldPath && file.oldPath !== file.path ? [file.oldPath, file.path] : [file.path]
      const patch = async (context: number) =>
        hunksOf(
          (await git(cwd, ['diff-tree', '-p', '-M', '--no-color', '--no-ext-diff', `--unified=${context}`, base, commit.sha, '--', ...paths]))
            .stdout,
        )
      let hunks = await patch(1_000_000)
      let context: 'full' | 'near' = 'full'
      if (hunks.length > SOURCE_BUDGET) {
        hunks = await patch(NEAR_CONTEXT)
        context = 'near'
      }
      if (hunks === '') {
        const what = file.status === 'R' || file.status === 'C' ? 'Renamed without changes.' : 'No textual changes (mode or type only).'
        return { kind: 'note', text: what }
      }
      return { kind: 'diff', context, ...fitHunks(hunks) }
    },

    async after(cwd: string, commit: Commit, file: ChangedFile): Promise<Content> {
      if (file.status === 'D') return { kind: 'note', text: 'This commit deletes the file.' }
      return blob(cwd, commit.sha, file.path)
    },

    async before(cwd: string, commit: Commit, file: ChangedFile): Promise<Content> {
      if (file.status === 'A') return { kind: 'note', text: 'The file did not exist before this commit.' }
      const parent = commit.parents[0]
      if (!parent) return { kind: 'note', text: 'Root commit: there is no earlier version.' }
      return blob(cwd, parent, file.oldPath ?? file.path)
    },
  }
}

export type Repo = ReturnType<typeof createRepo>
