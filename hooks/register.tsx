// commit-walk: a pane for reading a repository worktree by worktree and
// commit by commit, each changed file as a diff or as the whole file before
// and after. Everything shown comes from git; nothing is written anywhere.
//
// This file holds everything that uses `$`: the hooks, the state, loading and
// stepping. Claude Code before 2.1.300 follows `$` only into functions of the
// file that holds it, so this part stays in one file. The rest lives in:
//   pane/       the pane, one part per file, put together in pane/index.tsx;
//               it draws from the values read here and calls the actions built here
//   state.ts    constants and the first values of the state
//   git.ts      the git commands and their parsers
//   labels.ts   worktrees, commits and files as one line of text
//   welcome.ts  the welcome art; window.ts  the rows a long list shows
//
// Shape: the pane draws from two values the host keeps for the session
// (`selection`, where the person is; `snapshot`, what was loaded for it), so
// a hot reload keeps the place. Loading happens in handlers and events, never
// while drawing; a load that a newer one overtook is dropped.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { About, ChangedFile, Commit, Content, Expandable, GitTrace, RangeMode, Ranges, Selection, ViewMode, Worktree } from '../types'
import { createRepo, type GitRun, type Repo } from './git'
import { drawFailure, drawPane } from './pane'
import { frameOf, type Actions, type PaneValues } from './pane/frame'
import {
  EMPTY_SNAPSHOT, GIT_TIMEOUT_MS, INITIAL_SELECTION, PANE, PANE_COLUMNS, REFRESH_DELAY_MS, TITLE, TRACE_LENGTH, UNCOMMITTED, WRITING_TOOLS,
  type Depth,
} from './state'
import type { ListScroll } from './window'

const selection = atom({ plugin: 'commit-walk', key: 'selection' } as const, INITIAL_SELECTION)
const snapshot = atom({ plugin: 'commit-walk', key: 'snapshot' } as const, EMPTY_SNAPSHOT)
const expanded = atom({ plugin: 'commit-walk', key: 'expanded' } as const, null as Expandable | null)
const scroll = atom({ plugin: 'commit-walk', key: 'scroll' } as const, {} as Record<string, ListScroll>)
const debugOn = atom({ plugin: 'commit-walk', key: 'debug' } as const, false)
const trace = atom({ plugin: 'commit-walk', key: 'trace' } as const, [] as GitTrace[])
const about = atom({ plugin: 'commit-walk', key: 'about' } as const, { pluginVersion: null, engineVersion: null, cwd: '' } as About)

/** The session's working directory: where the repository is looked for. */
let sessionCwd = ''
/** Bumped by every load; a load whose ticket is no longer current writes nothing. */
let generation = 0
let refreshTimer: { cancel(): void } | null = null
/** How deep the pending refresh reads, while one is pending. */
let refreshDepth: 'repo' | 'changes' | null = null

// ── The hooks ────────────────────────────────────────────────────────────

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    sessionCwd = e.cwd
    await update($, about, () => ({ pluginVersion: null, engineVersion: null, cwd: e.cwd }))
    inBackground($, aboutHere($, e.cwd).then(found => update($, about, () => found)))
    // Named after the plugin. (/review is refused: it is an alias of the built-in /code-review.)
    try {
      await $.command.register({
        name: 'commit-walk',
        description: 'Open or close the commit walk pane: worktrees, commits and files of this repository',
        argumentHint: '[refresh|close|debug]',
        immediate: true,
      })
    } catch (cause) {
      $.ui.log(`commit-walk: /commit-walk is unavailable: ${messageOf(cause)}`)
    }
    return next(e)
  })

  on('command.run', { command: 'commit-walk' }, async ($, e) => {
    const arg = e.args.trim()
    const isOpen = await isPaneOpen($)
    if (arg === 'close' || (arg === '' && isOpen)) {
      cancelRefresh()
      await $.ui.close({ id: PANE })
      return { text: 'Commit walk closed.' }
    }
    if (arg === 'debug') {
      const isOn = !(await read($, debugOn))
      await update($, debugOn, () => isOn)
      if (!isOpen) {
        await $.ui.open({ id: PANE, title: TITLE, focus: true, closeOnEscape: true, columns: PANE_COLUMNS })
        await load($, 'repo')
      }
      return { text: `Commit walk debug section ${isOn ? 'shown' : 'hidden'}.` }
    }
    if (arg !== '' && arg !== 'refresh') return { text: 'Usage: /commit-walk [refresh|close|debug]' }

    // Open first so the pane shows its loading line, then answer once it has loaded.
    const opened = await $.ui.open({ id: PANE, title: TITLE, focus: true, closeOnEscape: true, columns: PANE_COLUMNS })
    await load($, 'repo')
    if (!opened.isPlaced) return { text: `Commit walk is open but not drawn yet: ${opened.reason}` }
    return { text: arg === 'refresh' ? 'Commit walk refreshed.' : 'Commit walk opened.' }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    cancelRefresh()
    return next(e)
  })

  on('tool.call', { tool: WRITING_TOOLS }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny && result.isError !== true && result.isReadOnly !== true) scheduleRefresh($, 'changes')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    scheduleRefresh($, 'repo')
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const place = { bodyColumns: e.props.bodyColumns, bodyRows: e.props.scroll.bodyRows, placement: e.props.placement, surface: e.surface }
    const ui = $.ui.resolve(e)
    try {
      return drawPane(frameOf(await paneValues($), actionsFor($), ui, place))
    } catch (cause) {
      return drawFailure(ui, messageOf(cause))
    }
  })
}

// ── What the pane draws from, and what its buttons do ────────────────────

async function paneValues($: EngineInterface): Promise<PaneValues> {
  const isDebug = await read($, debugOn)
  return {
    sel: await read($, selection),
    snap: await read($, snapshot),
    open: await read($, expanded),
    scrolled: await read($, scroll),
    isDebug,
    gitRuns: isDebug ? await read($, trace) : [],
    where: isDebug ? await read($, about) : null,
  }
}

function actionsFor($: EngineInterface): Actions {
  return {
    load: (depth, change) => inBackground($, load($, depth, change)),
    stepCommit: delta => inBackground($, stepCommit($, delta)),
    stepFile: delta => inBackground($, stepFile($, delta)),
    toggleDebug: () => inBackground($, update($, debugOn, now => !now)),
    toggleList: which => inBackground($, update($, expanded, now => (now === which ? null : which))),
    foldLists: () => inBackground($, update($, expanded, () => null)),
    scrollList: (prefix, at) => inBackground($, update($, scroll, all => ({ ...all, [prefix]: at }))),
  }
}

// ── Git through the host ─────────────────────────────────────────────────

function repoFor($: EngineInterface): Repo {
  return createRepo(async (cwd, args): Promise<GitRun> => {
    const started = Date.now()
    // No optional locks: reading must never contend with an agent's index writes.
    const result = await $.process.run(['git', '-c', 'core.quotepath=off', '--no-pager', ...args], {
      cwd,
      timeoutMs: GIT_TIMEOUT_MS,
      env: { GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat', LC_ALL: 'C' },
    })
    const entry: GitTrace = {
      args: args.join(' '),
      cwd,
      exitCode: result.exitCode,
      ms: Date.now() - started,
      error: result.exitCode === 0 ? null : result.stderr.trim().split('\n')[0] ?? '',
    }
    await update($, trace, list => [...list, entry].slice(-TRACE_LENGTH))
    return result
  })
}

/** The plugin's version from its manifest and the engine's, for the debug section; null where unknown. */
async function aboutHere($: EngineInterface, cwd: string): Promise<About> {
  let pluginVersion: string | null = null
  let engineVersion: string | null = null
  try {
    const manifest = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)) as { version?: unknown }
    pluginVersion = typeof manifest.version === 'string' ? manifest.version : null
  } catch {
    pluginVersion = null
  }
  try {
    // Absent before Claude Code 2.1.300: the call rejects there and the version reads unknown.
    engineVersion = (await $.session.version()).version
  } catch {
    engineVersion = null
  }
  return { pluginVersion, engineVersion, cwd }
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * Starts `work` without waiting for it. A failure shows in the pane's error
 * line instead of vanishing, or in the transcript when even that fails.
 */
function inBackground($: EngineInterface, work: Promise<unknown>) {
  void work.catch(async cause => {
    try {
      await update($, snapshot, snap => ({ ...snap, isLoading: false, error: messageOf(cause) }))
    } catch {
      try {
        $.ui.log(`commit-walk: ${messageOf(cause)}`)
      } catch {
        // Nowhere left to say it.
      }
    }
  })
}

// ── Loading ──────────────────────────────────────────────────────────────

async function contentFor(repo: Repo, cwd: string, commit: Commit, file: ChangedFile, mode: ViewMode): Promise<Content> {
  if (mode === 'after') return repo.after(cwd, commit, file)
  if (mode === 'before') return repo.before(cwd, commit, file)
  return repo.diff(cwd, commit, file)
}

async function uncommittedContentFor(repo: Repo, cwd: string, file: ChangedFile, mode: ViewMode, head: string | null): Promise<Content> {
  if (mode === 'after') return repo.uncommittedAfter(cwd, file)
  if (mode === 'before') return repo.uncommittedBefore(cwd, file, head)
  return repo.uncommittedDiff(cwd, file)
}

function chooseWorktree(worktrees: Worktree[], wanted: string | null, root: string): Worktree | undefined {
  return worktrees.find(wt => wt.path === wanted) ?? worktrees.find(wt => wt.path === root) ?? worktrees[0]
}

async function load($: EngineInterface, depth: Depth, change: Partial<Selection> = {}) {
  const ticket = ++generation
  const was = await read($, selection)
  const before = await read($, snapshot)
  const want: Selection = { ...was, ...change }
  await update($, snapshot, snap => ({ ...snap, isLoading: true }))

  // Kept outside the try: a failure part way keeps what did load and says what failed.
  let { repoRoot, worktrees, commits, ranges, files, uncommitted, head } = before
  try {
    const repo = repoFor($)

    // A refresh after an edit reads the commits again only when HEAD moved.
    let level = depth
    if (level === 'changes') {
      const shown = repoRoot === null ? undefined : chooseWorktree(worktrees, want.worktree, repoRoot)
      if (!shown || (await repo.head(shown.path)) !== before.head) level = 'repo'
    }

    if (level === 'repo' || repoRoot === null) {
      repoRoot = await repo.toplevel(sessionCwd || '.')
      worktrees = await repo.worktrees(repoRoot)
    }
    const worktree = chooseWorktree(worktrees, want.worktree, repoRoot)
    if (!worktree) throw new Error('No worktree to show.')
    const isNewWorktree = worktree.path !== was.worktree

    const isNewRange = want.range !== was.range
    const isRepo = level === 'repo' || repoRoot !== before.repoRoot || isNewWorktree
    if (isRepo) {
      ranges = await repo.ranges(worktree.path)
    }
    // A range the worktree does not offer reads as its whole history.
    const range: RangeMode = rangeRef(ranges, want.range) === null ? 'all' : want.range
    if (isRepo || isNewRange) {
      commits = await repo.log(worktree.path, rangeRef(ranges, range))
    }
    if (isRepo || level === 'changes') {
      head = await repo.head(worktree.path)
      uncommitted = await repo.uncommitted(worktree.path)
    }

    // An explicit pick wins; otherwise keep the place, or follow the newest commit. The
    // uncommitted changes are kept while there are any, and shown when there is no commit.
    const keepCommit = 'commit' in change ? want.commit : isNewWorktree || was.isFollowing ? null : was.commit
    const isUncommitted = uncommitted.length > 0 && (keepCommit === UNCOMMITTED || commits.length === 0)
    const commit = isUncommitted ? undefined : (commits.find(one => one.sha === keepCommit) ?? commits[0])
    const wasHere = isUncommitted ? was.commit === UNCOMMITTED : commit !== undefined && commit.sha === was.commit

    if (isUncommitted) {
      files = uncommitted
    } else if (commit && (!wasHere || isNewWorktree || level === 'repo' || level === 'commit')) {
      files = await repo.changes(worktree.path, commit)
    } else if (!commit) {
      files = []
    }
    const keepFile = 'file' in change ? want.file : wasHere ? was.file : null
    const file = files.find(one => one.path === keepFile) ?? files[0]

    // A refresh that left a commit's file and view as they were keeps what they show.
    const isSameView = level === 'changes' && !isUncommitted && wasHere && file?.path === was.file && want.mode === was.mode
    let content: Content | null = null
    if (isSameView) content = before.content
    else if (isUncommitted && file) content = await uncommittedContentFor(repo, worktree.path, file, want.mode, head)
    else if (commit && file) content = await contentFor(repo, worktree.path, commit, file, want.mode)
    else if (commit) content = { kind: 'note', text: 'This commit changes no files (an empty or merge-only commit).' }
    else content = { kind: 'note', text: 'This worktree has no commits yet.' }

    if (ticket !== generation) return
    await update($, selection, () => ({
      worktree: worktree.path,
      commit: isUncommitted ? UNCOMMITTED : (commit?.sha ?? null),
      file: file?.path ?? null,
      mode: want.mode,
      isFollowing: commit !== undefined && commit.sha === commits[0]?.sha,
      // The preference, not the fallback: a worktree without the range does not reset it.
      range: want.range,
    }))
    await update($, snapshot, () => ({
      repoRoot,
      worktrees,
      commits,
      ranges,
      range,
      files,
      uncommitted,
      head,
      content,
      isLoading: false,
      error: null,
      loadedAt: Date.now(),
    }))
  } catch (cause) {
    if (ticket !== generation) return
    const reached = { repoRoot, worktrees, commits, ranges, uncommitted, head }
    await update($, snapshot, snap => ({ ...snap, ...reached, isLoading: false, error: messageOf(cause) }))
  }
}

/** The ref a range starts after, or null for the whole history or a range the worktree does not offer. */
function rangeRef(ranges: Ranges, mode: RangeMode): string | null {
  if (mode === 'notInDefault') return ranges.notInDefault?.ref ?? null
  if (mode === 'base') return ranges.base?.ref ?? null
  return null
}

// ── Refreshing ───────────────────────────────────────────────────────────

async function isPaneOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE)
}

/**
 * A refresh shortly after an edit (`changes`) or a turn's end (`repo`, which
 * also sees new worktrees and branches). Refreshes that come close together
 * run once, as deep as the deepest of them.
 */
function scheduleRefresh($: EngineInterface, depth: 'repo' | 'changes') {
  const deepest = refreshDepth === 'repo' ? 'repo' : depth
  cancelRefresh()
  refreshDepth = deepest
  refreshTimer = $.clock.after(REFRESH_DELAY_MS, () => {
    refreshTimer = null
    refreshDepth = null
    inBackground($, refreshIfOpen($, deepest))
  })
}

function cancelRefresh() {
  refreshTimer?.cancel()
  refreshTimer = null
  refreshDepth = null
}

async function refreshIfOpen($: EngineInterface, depth: 'repo' | 'changes') {
  if (await isPaneOpen($)) await load($, depth)
}

// ── Stepping (handlers: they read the current values, never drawn ones) ──

/** One step older (1) or newer (-1); the uncommitted changes, when there are any, come after the newest commit. */
async function stepCommit($: EngineInterface, delta: 1 | -1) {
  const sel = await read($, selection)
  const { commits, uncommitted } = await read($, snapshot)
  const order = [...(uncommitted.length > 0 ? [UNCOMMITTED] : []), ...commits.map(one => one.sha)]
  const at = order.indexOf(sel.commit ?? '')
  const target = order[at + delta]
  if (at < 0 || target === undefined) return
  await load($, 'commit', { commit: target, file: null })
}

async function stepFile($: EngineInterface, delta: 1 | -1) {
  const sel = await read($, selection)
  const { files } = await read($, snapshot)
  const at = files.findIndex(one => one.path === sel.file)
  const target = files[at + delta]
  if (at < 0 || !target) return
  await load($, 'content', { file: target.path })
}
