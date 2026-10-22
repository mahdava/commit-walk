// Git for the commit-walk pane: the commands it runs and the parsers for
// their output. No engine calls here: `createRepo` takes the runner, so the
// tests drive it with canned git output.

import type { ChangedFile, Commit, Content, FileStatus, Ranges, Stage, Worktree } from '../types'

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
/** Untracked files whose lines are counted, one git run each; the rest read as "new file". */
const MAX_UNTRACKED_COUNTED = 50
/** Context that takes in a whole file: the diff then holds every line of both sides. */
const WHOLE_FILE = 1_000_000

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

type StatusEntry = { xy: string; path: string; oldPath: string | null }

/**
 * `git status --porcelain=v1 -z`: `XY path`, NUL-ended; a rename or copy is
 * followed by its old path. X is the staged change, Y the unstaged one.
 */
export function parseStatus(text: string): StatusEntry[] {
  const tokens = text.split('\0')
  const out: StatusEntry[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? ''
    if (token.length < 4 || token.charAt(2) !== ' ') continue
    const xy = token.slice(0, 2)
    const path = token.slice(3)
    const isMoved = /[RC]/.test(xy)
    const oldPath = isMoved ? (tokens[i + 1] ?? null) : null
    if (isMoved) i += 1
    out.push({ xy, path, oldPath })
  }
  return out
}

/** The one letter a file row shows for an uncommitted file's status: the staged change's, else the unstaged one's. */
export function statusOf(xy: string): FileStatus {
  if (xy === '??') return 'A'
  const letter = (xy.charAt(0) === ' ' ? xy.charAt(1) : xy.charAt(0)) as FileStatus
  return STATUSES.has(letter) ? letter : 'M'
}

/**
 * The new side of a whole-file diff (`--unified` past the file's length):
 * its unchanged and added lines, in order. How the pane shows a file as it
 * is on disk using git alone.
 */
export function afterFromHunks(hunks: string): string {
  const kept: string[] = []
  for (const line of hunks.split('\n')) {
    if (line.startsWith(' ') || line.startsWith('+')) kept.push(line.slice(1))
  }
  return kept.join('\n')
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

  /** A diff command's output. `--no-index` exits 1 when the two sides differ, which is not a failure. */
  async function gitDiff(cwd: string, args: readonly string[]): Promise<GitRun> {
    const result = await run(cwd, args)
    if (result.exitCode === 0 || (result.exitCode === 1 && args.includes('--no-index'))) return result
    throw new GitError(args, result)
  }

  /**
   * A one-file diff fitted to `budget`: the whole file as context when it
   * fits, else NEAR_CONTEXT lines around each change. Null when there are no
   * textual changes, `binary` for a binary file.
   */
  async function fitPatch(cwd: string, argsFor: (context: number) => string[], budget = SOURCE_BUDGET) {
    const patch = async (context: number) => {
      const out = (await gitDiff(cwd, argsFor(context))).stdout
      return { hunks: hunksOf(out), isBinary: /^Binary files /m.test(out) }
    }
    let { hunks, isBinary } = await patch(WHOLE_FILE)
    if (isBinary) return 'binary' as const
    let context: 'full' | 'near' = 'full'
    if (hunks.length > budget) {
      hunks = (await patch(NEAR_CONTEXT)).hunks
      context = 'near'
    }
    if (hunks === '') return null
    return { context, ...fitHunks(hunks, budget) }
  }

  /** HEAD's SHA, or null before the first commit. */
  async function head(cwd: string): Promise<string | null> {
    const found = await run(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD'])
    return found.exitCode === 0 ? found.stdout.trim() || null : null
  }

  /** An untracked file's line counts, from git's diff of it against nothing. */
  async function untrackedStat(cwd: string, path: string): Promise<{ added: number; deleted: number; isBinary: boolean }> {
    const out = (await gitDiff(cwd, ['diff', '--no-index', '--numstat', '--', '/dev/null', path])).stdout
    const match = /^(-|\d+)\t(-|\d+)\t/.exec(out)
    if (!match || match[1] === '-') return { added: 0, deleted: 0, isBinary: match !== null }
    return { added: Number(match[1]), deleted: Number(match[2]), isBinary: false }
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
      // Offered wherever there is a default branch: on it, or on a branch level with it, the
      // range is empty, and the pane shows its welcome screen until a commit lands.
      const notInDefault = defaultRef && defaultAhead !== null ? { ref: defaultRef, count: defaultAhead } : null
      const isOnDefault = defaultName !== null && branch === defaultName

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
      return { branch, isOnDefault, notInDefault, base }
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
      const fitted = await fitPatch(cwd, context => ['diff-tree', '-p', '-M', '--no-color', '--no-ext-diff', `--unified=${context}`, base, commit.sha, '--', ...paths])
      if (fitted === 'binary') return { kind: 'note', text: 'Binary file: no text diff.' }
      if (fitted === null) {
        const what = file.status === 'R' || file.status === 'C' ? 'Renamed without changes.' : 'No textual changes (mode or type only).'
        return { kind: 'note', text: what }
      }
      return { kind: 'diff', ...fitted }
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

    // ── Uncommitted changes: staged, unstaged and untracked, against HEAD ──

    head,

    /**
     * The worktree's uncommitted files, as `git status` lists them (so what
     * .gitignore skips is left out), with line counts against HEAD, or
     * against the empty tree before the first commit.
     */
    async uncommitted(cwd: string): Promise<ChangedFile[]> {
      const listed = parseStatus((await git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])).stdout)
      if (listed.length === 0) return []
      const base = (await head(cwd)) ?? (await emptyTree(cwd))
      const stats = parseNumstat((await git(cwd, ['diff', '-M', '-z', '--numstat', '--no-ext-diff', base])).stdout)
      const byPath = new Map(stats.map(stat => [stat.path, stat]))
      const untracked = listed.filter(one => one.xy === '??').slice(0, MAX_UNTRACKED_COUNTED)
      const counted = new Map(await Promise.all(untracked.map(async one => [one.path, await untrackedStat(cwd, one.path)] as const)))
      return listed.map(one => {
        const stat = byPath.get(one.path) ?? counted.get(one.path)
        return {
          status: statusOf(one.xy),
          path: one.path,
          oldPath: one.oldPath,
          xy: one.xy,
          isBinary: stat?.isBinary ?? false,
          added: stat?.added ?? 0,
          deleted: stat?.deleted ?? 0,
          ...(one.xy === '??' && !stat ? { isUncounted: true } : {}),
        }
      })
    },

    /** An uncommitted file's diff: the staged part against HEAD, the unstaged part against what is staged. */
    async uncommittedDiff(cwd: string, file: ChangedFile): Promise<Content> {
      if (file.isBinary) return { kind: 'note', text: 'Binary file: no text diff.' }
      const xy = file.xy ?? '  '
      const paths = file.oldPath && file.oldPath !== file.path ? [file.oldPath, file.path] : [file.path]
      const common = ['--no-color', '--no-ext-diff']
      const wanted: { stage: Stage; argsFor: (context: number) => string[] }[] = []
      if (xy === '??') {
        wanted.push({ stage: 'unstaged', argsFor: context => ['diff', '--no-index', ...common, `--unified=${context}`, '--', '/dev/null', file.path] })
      } else {
        if (xy.charAt(0) !== ' ') wanted.push({ stage: 'staged', argsFor: context => ['diff', '--cached', '-M', ...common, `--unified=${context}`, '--', ...paths] })
        if (xy.charAt(1) !== ' ') wanted.push({ stage: 'unstaged', argsFor: context => ['diff', ...common, `--unified=${context}`, '--', file.path] })
      }
      const budget = Math.floor(SOURCE_BUDGET / Math.max(1, wanted.length))
      const parts: Extract<Content, { kind: 'parts' }>['parts'] = []
      for (const one of wanted) {
        const fitted = await fitPatch(cwd, one.argsFor, budget)
        if (fitted === 'binary') return { kind: 'note', text: 'Binary file: no text diff.' }
        if (fitted) parts.push({ stage: one.stage, ...fitted })
      }
      if (parts.length > 0) return { kind: 'parts', parts }
      if (xy === '??') return { kind: 'note', text: 'A new, empty file.' }
      return { kind: 'note', text: /[RC]/.test(xy) ? 'Renamed without changes.' : 'No textual changes (mode or type only).' }
    },

    /** An uncommitted file as it is now: rebuilt from git's whole-file diff when it differs from what is staged. */
    async uncommittedAfter(cwd: string, file: ChangedFile): Promise<Content> {
      const xy = file.xy ?? '  '
      if (xy.charAt(1) === 'D' || xy === 'D ') return { kind: 'note', text: 'The file is deleted: there is nothing on disk to show.' }
      if (file.isBinary) return { kind: 'note', text: 'Binary file: no text to show.' }
      if (xy === '??' || xy.charAt(1) !== ' ') {
        const args =
          xy === '??'
            ? ['diff', '--no-index', '--no-color', '--no-ext-diff', `--unified=${WHOLE_FILE}`, '--', '/dev/null', file.path]
            : ['diff', '--no-color', '--no-ext-diff', `--unified=${WHOLE_FILE}`, '--', file.path]
        const result = await gitDiff(cwd, args)
        if (/^Binary files /m.test(result.stdout)) return { kind: 'note', text: 'Binary file: no text to show.' }
        const hunks = hunksOf(result.stdout)
        if (hunks !== '') {
          const fitted = fitText(afterFromHunks(hunks))
          return { kind: 'file', path: file.path, source: fitted.source, isTruncated: fitted.isTruncated || result.isStdoutTruncated === true }
        }
        if (xy === '??') return { kind: 'note', text: 'A new, empty file.' }
      }
      // What is on disk matches what is staged, so the staged copy shows it.
      return blob(cwd, '', file.path)
    },

    /** An uncommitted file as the last commit has it. */
    async uncommittedBefore(cwd: string, file: ChangedFile, headSha: string | null): Promise<Content> {
      if (headSha === null) return { kind: 'note', text: 'No commits yet: there is no earlier version.' }
      const xy = file.xy ?? '  '
      if (xy === '??' || xy.charAt(0) === 'A') return { kind: 'note', text: 'A new file: the last commit does not have it.' }
      return blob(cwd, headSha, file.oldPath ?? file.path)
    },
  }
}

export type Repo = ReturnType<typeof createRepo>
