// commit-walk: a pane for reading a repository worktree by worktree and
// commit by commit, each changed file as a diff or as the whole file before
// and after. Everything shown comes from git; nothing is written anywhere.
//
// Shape: the pane draws from two values the host keeps for the session
// (`selection`, where the person is; `snapshot`, what was loaded for it), so
// a hot reload keeps the place. Loading happens in handlers and events, never
// while drawing; a load that a newer one overtook is dropped.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { About, ChangedFile, Commit, Content, Expandable, GitTrace, RangeMode, Ranges, Selection, Snapshot, ViewMode, Worktree } from '../types'
import { createRepo, type GitRun, type Repo } from './git'
import { FLOWER_40, FLOWER_60, LOGO_60, LOGO_80, type RasterArt } from './raster-art'
import { COLOR } from './welcome'
import { scrollStart, type ListScroll } from './window'

const PANE = 'commit-walk'
const TITLE = 'Commit walk'
/** Width the dock asks for beside a fullscreen transcript. */
const PANE_COLUMNS = 84
/** Debounce for refreshes after edits and turns. */
const REFRESH_DELAY_MS = 400
/** Rows a list shows at once; more page with its edge rows. */
const LIST_ROWS = 8
/** The colour of git's status letter in the file list. */
const STATUS_COLOR: Partial<Record<string, string>> = { A: '#2EA043', D: '#EF4444', R: '#3B82F6', C: '#3B82F6', M: '#E08A00' }
const GIT_TIMEOUT_MS = 20_000
/** Tools whose successful, non-read-only calls may have changed the repository. */
const WRITING_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'Bash'] as const

const INITIAL_SELECTION: Selection = { worktree: null, commit: null, file: null, mode: 'diff', isFollowing: true, range: 'notInDefault' }
const EMPTY_SNAPSHOT: Snapshot = {
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

const selection = atom({ plugin: 'commit-walk', key: 'selection' } as const, INITIAL_SELECTION)
const snapshot = atom({ plugin: 'commit-walk', key: 'snapshot' } as const, EMPTY_SNAPSHOT)
const expanded = atom({ plugin: 'commit-walk', key: 'expanded' } as const, null as Expandable | null)
const scroll = atom({ plugin: 'commit-walk', key: 'scroll' } as const, {} as Record<string, ListScroll>)
const debugOn = atom({ plugin: 'commit-walk', key: 'debug' } as const, false)
const trace = atom({ plugin: 'commit-walk', key: 'trace' } as const, [] as GitTrace[])
const about = atom({ plugin: 'commit-walk', key: 'about' } as const, { pluginVersion: null, engineVersion: null, cwd: '' } as About)
/** Git commands the debug section keeps. */
const TRACE_LENGTH = 10

/** The session's working directory: where the repository is looked for. */
let sessionCwd = ''
/** Bumped by every load; a load whose ticket is no longer current writes nothing. */
let generation = 0
let refreshTimer: { cancel(): void } | null = null

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

// ── Loading ──────────────────────────────────────────────────────────────

/**
 * How much to load again: `repo` re-reads worktrees and commits (open,
 * refresh, another worktree); `commit` the changed files; `content` the code
 * area alone (another file or view).
 */
type Depth = 'repo' | 'commit' | 'content'

async function contentFor(repo: Repo, cwd: string, commit: Commit, file: ChangedFile, mode: ViewMode): Promise<Content> {
  if (mode === 'after') return repo.after(cwd, commit, file)
  if (mode === 'before') return repo.before(cwd, commit, file)
  return repo.diff(cwd, commit, file)
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
  let { repoRoot, worktrees, commits, ranges, files } = before
  try {
    const repo = repoFor($)

    if (depth === 'repo' || repoRoot === null) {
      repoRoot = await repo.toplevel(sessionCwd || '.')
      worktrees = await repo.worktrees(repoRoot)
    }
    const worktree = chooseWorktree(worktrees, want.worktree, repoRoot)
    if (!worktree) throw new Error('No worktree to show.')
    const isNewWorktree = worktree.path !== was.worktree

    const isNewRange = want.range !== was.range
    if (depth === 'repo' || repoRoot !== before.repoRoot || isNewWorktree) {
      ranges = await repo.ranges(worktree.path)
    }
    // A range the worktree does not offer reads as its whole history.
    const range: RangeMode = rangeRef(ranges, want.range) === null ? 'all' : want.range
    if (depth === 'repo' || repoRoot !== before.repoRoot || isNewWorktree || isNewRange) {
      commits = await repo.log(worktree.path, rangeRef(ranges, range))
    }
    // An explicit pick wins; otherwise keep the commit, or follow the newest.
    const keepCommit = 'commit' in change ? want.commit : isNewWorktree || was.isFollowing ? null : was.commit
    const commit = commits.find(one => one.sha === keepCommit) ?? commits[0]

    if (commit && (depth !== 'content' || commit.sha !== was.commit || isNewWorktree)) {
      files = await repo.changes(worktree.path, commit)
    } else if (!commit) {
      files = []
    }
    const keepFile = 'file' in change ? want.file : commit?.sha === was.commit ? was.file : null
    const file = files.find(one => one.path === keepFile) ?? files[0]

    let content: Content | null = null
    if (commit && file) content = await contentFor(repo, worktree.path, commit, file, want.mode)
    else if (commit) content = { kind: 'note', text: 'This commit changes no files (an empty or merge-only commit).' }
    else content = { kind: 'note', text: 'This worktree has no commits yet.' }

    if (ticket !== generation) return
    await update($, selection, () => ({
      worktree: worktree.path,
      commit: commit?.sha ?? null,
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
      content,
      isLoading: false,
      error: null,
      loadedAt: Date.now(),
    }))
  } catch (cause) {
    if (ticket !== generation) return
    const reached = { repoRoot, worktrees, commits, ranges }
    await update($, snapshot, snap => ({ ...snap, ...reached, isLoading: false, error: messageOf(cause) }))
  }
}

/** The ref a range starts after, or null for the whole history or a range the worktree does not offer. */
function rangeRef(ranges: Ranges, mode: RangeMode): string | null {
  if (mode === 'notInDefault') return ranges.notInDefault?.ref ?? null
  if (mode === 'base') return ranges.base?.ref ?? null
  return null
}

async function isPaneOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE)
}

function scheduleRefresh($: EngineInterface) {
  refreshTimer?.cancel()
  refreshTimer = $.clock.after(REFRESH_DELAY_MS, () => {
    refreshTimer = null
    void refreshIfOpen($)
  })
}

async function refreshIfOpen($: EngineInterface) {
  if (await isPaneOpen($)) await load($, 'repo')
}

// ── Stepping (handlers: they read the current values, never drawn ones) ──

async function stepCommit($: EngineInterface, delta: 1 | -1) {
  const sel = await read($, selection)
  const { commits } = await read($, snapshot)
  const at = commits.findIndex(one => one.sha === sel.commit)
  const target = commits[at + delta]
  if (at < 0 || !target) return
  await load($, 'commit', { commit: target.sha, file: null })
}

async function stepFile($: EngineInterface, delta: 1 | -1) {
  const sel = await read($, selection)
  const { files } = await read($, snapshot)
  const at = files.findIndex(one => one.path === sel.file)
  const target = files[at + delta]
  if (at < 0 || !target) return
  await load($, 'content', { file: target.path })
}

// ── Labels ───────────────────────────────────────────────────────────────

function clip(text: string, width: number): string {
  const room = Math.max(8, width)
  return text.length <= room ? text : `${text.slice(0, room - 1)}…`
}

function baseName(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() ?? path
}

function worktreeLabel(wt: Worktree): string {
  const ref = wt.branch ?? `detached @ ${wt.head.slice(0, 7)}`
  return `${ref}  ·  ${baseName(wt.path)}${wt.isLocked ? '  (locked)' : ''}`
}

function commitLabel(commit: Commit): string {
  return `${commit.shortSha}  ${commit.subject}`
}

// ── The hooks ────────────────────────────────────────────────────────────

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    sessionCwd = e.cwd
    await update($, about, () => ({ pluginVersion: null, engineVersion: null, cwd: e.cwd }))
    void aboutHere($, e.cwd).then(found => update($, about, () => found))
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
      refreshTimer?.cancel()
      refreshTimer = null
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
    refreshTimer?.cancel()
    refreshTimer = null
    return next(e)
  })

  on('tool.call', { tool: WRITING_TOOLS }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny && result.isError !== true && result.isReadOnly !== true) scheduleRefresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    scheduleRefresh($)
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Text, Button, Code } = table
    const sel = await read($, selection)
    const snap = await read($, snapshot)
    const open = await read($, expanded)
    const isDebug = await read($, debugOn)
    const scrolled = await read($, scroll)
    const gitRuns = isDebug ? await read($, trace) : []
    const where = isDebug ? await read($, about) : null
    const width = Math.max(24, e.props.bodyColumns)

    const rows = e.props.scroll.bodyRows
    let artTier: string | null = null

    // What the debug section shows: where the pane runs, what it holds, the
    // last git commands. Drawn at the bottom of every screen while it is on.
    const debugButton = (
      <Button key="debug" hotkey="x" dimColor onPress={() => void update($, debugOn, now => !now)}>
        {isDebug ? 'Hide debug' : 'Debug'}
      </Button>
    )
    const debugSection = () => {
      if (!isDebug || where === null) return null
      const line = (text: string, key: string) => <Text key={key} dimColor wrap="truncate-end">{text}</Text>
      const counts = `${snap.worktrees.length} worktrees · ${snap.commits.length} commits · ${snap.files.length} files`
      const age = snap.loadedAt === null ? 'never loaded' : `loaded ${Math.round((Date.now() - snap.loadedAt) / 1000)}s ago`
      return (
        <Box flexDirection="column" borderStyle="single" borderDimColor>
          <Text bold dimColor>Debug</Text>
          {line(`commit-walk ${where.pluginVersion ?? '?'} · Claude Code ${where.engineVersion ?? 'unknown (before 2.1.300)'} · ${e.surface}`, 'd-versions')}
          {line(`pane ${e.props.bodyColumns}×${rows} ${e.props.placement}${artTier ? ` · welcome art: ${artTier}` : ''}`, 'd-pane')}
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

    // The welcome art: the logo as a Raster, two pixels a cell, the largest
    // that fits with room for the message under it, centred. The one-line mark
    // where there is no room, where the pane sits inline above the prompt, and
    // on surfaces without a Raster (desktop, VS Code, mobile).
    const mark = (
      <Text bold color={COLOR.leaf}>
        <Text color={COLOR.petal}>✿</Text> Commit Walk
      </Text>
    )
    const welcome = () => {
      const Raster = e.surface === 'terminal' && 'Raster' in table ? table.Raster : null
      const fits = (art: RasterArt) => width >= art.columns && rows >= art.rows + 10
      const art = Raster && e.props.placement === 'dock' ? [LOGO_80, LOGO_60, FLOWER_60, FLOWER_40].find(fits) : undefined
      if (!Raster || !art) {
        artTier = 'one-line mark'
        return mark
      }
      artTier = `raster ${art.columns}×${art.rows}`
      const hasTitle = art === LOGO_80 || art === LOGO_60
      const title = 'Commit Walk'
      return (
        <Box flexDirection="column">
          <Box paddingLeft={Math.max(0, Math.floor((width - art.columns) / 2))}>
            <Raster key="welcome-art" columns={art.columns} rows={art.rows} cells={art.cells} />
          </Box>
          {hasTitle ? null : (
            <Text bold color={COLOR.leaf}>
              {' '.repeat(Math.max(0, Math.floor((width - title.length) / 2)))}
              {title}
            </Text>
          )}
        </Box>
      )
    }

    if (snap.repoRoot === null && snap.error) {
      return (
        <Box flexDirection="column" gap={1}>
          {welcome()}
          <Text bold>No repository to review</Text>
          <Text color="red">{snap.error}</Text>
          <Text dimColor>Start Claude Code inside a Git repository, then run /commit-walk.</Text>
          <Box flexDirection="row" gap={1}>
            <Button key="refresh" hotkey="r" onPress={() => void load($, 'repo')}>Try again</Button>
            {debugButton}
          </Box>
          {debugSection()}
        </Box>
      )
    }
    if (snap.repoRoot === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {welcome()}
          <Text dimColor>Reading the repository…</Text>
          {debugSection()}
        </Box>
      )
    }

    const worktree = snap.worktrees.find(wt => wt.path === sel.worktree)
    const commitAt = snap.commits.findIndex(one => one.sha === sel.commit)
    const commit = snap.commits[commitAt]
    const fileAt = snap.files.findIndex(one => one.path === sel.file)
    const file = snap.files[fileAt]
    const content = snap.content

    const mode = (key: ViewMode, label: string, hotkey: string) => (
      <Button
        key={`mode-${key}`}
        hotkey={hotkey}
        variant={sel.mode === key ? 'primary' : undefined}
        onPress={() => void load($, 'content', { mode: key })}
      >
        {label}
      </Button>
    )

    // Lists are whole-row buttons: the full width of a row is the click target.
    // Inside a rounded frame, so a row is the frame's inner width.
    const inner = Math.max(10, width - 2)
    const pad = (text: string, room = inner) => text.padEnd(room).slice(0, room)

    /**
     * The full text of a clipped row, revealed while the pointer is over the
     * row (its keyed Box): drawn below it, over the rows that follow, without
     * moving them. Inverse video makes it a solid block in any theme. Claude
     * Code shows it where the terminal reports the pointer; no hook runs.
     */
    const hoverCard = (key: string, full: string, indent: number) => {
      const cardWidth = Math.max(10, inner - indent - 1)
      const lines: string[] = []
      for (let at = 0; at < full.length; at += cardWidth - 2) lines.push(full.slice(at, at + cardWidth - 2))
      return (
        // No key: a keyed Box would scope the hover to itself, hidden and never hovered. The row's keyed Box is the scope.
        <Box position="absolute" top={1} left={indent} display="none" hover={{ display: 'flex' }} flexDirection="column">
          {lines.map((line, i) => (
            <Text key={`${key}-${i}`} inverse>{` ${line.padEnd(cardWidth - 2)} `}</Text>
          ))}
        </Box>
      )
    }

    /**
     * The rows of a list, LIST_ROWS at a time. Each row: a ▶ on the selected
     * one, an optional coloured tag, the entry's text as a whole-row button.
     * A longer list gets a scroll column on the right: ▲ and ▼ page through it
     * without changing the selection, and a thumb shows where the rows are.
     */
    const rowList = <T,>(spec: {
      prefix: string
      items: readonly T[]
      at: number
      keyOf: (item: T) => string
      tagOf?: (item: T) => { text: string; color: string | undefined }
      textOf: (item: T) => string
      noun: { one: string; many: string }
      onPick: (item: T) => void
    }) => {
      const total = spec.items.length
      const size = Math.min(LIST_ROWS, total)
      const selectedKey = spec.items[spec.at] === undefined ? null : spec.keyOf(spec.items[spec.at] as T)
      const start = scrollStart(total, spec.at, LIST_ROWS, scrolled[spec.prefix], selectedKey)
      const shown = spec.items.slice(start, start + size)
      const hasBar = total > LIST_ROWS
      const room = hasBar ? inner - 2 : inner
      const last = total - LIST_ROWS
      const scrollTo = (to: number) =>
        void update($, scroll, all => ({ ...all, [spec.prefix]: { start: Math.min(Math.max(to, 0), last), anchor: selectedKey } }))

      const rows = shown.map((item, i) => {
        const isSelected = start + i === spec.at
        const tag = spec.tagOf?.(item)
        const used = 2 + (tag ? tag.text.length + 2 : 0)
        const full = spec.textOf(item)
        const isClipped = full.length > room - used - 1
        return (
          // The marker and the coloured tag are text in front of the button,
          // which holds one string: Claude Code before 2.1.300 refuses a
          // Button with element children.
          <Box key={`${spec.prefix}-row:${spec.keyOf(item)}`} flexDirection="row">
            <Text color={isSelected ? COLOR.petal : undefined} bold={isSelected}>{isSelected ? '▶ ' : '  '}</Text>
            {tag ? <Text color={tag.color}>{tag.text}  </Text> : null}
            <Button key={`${spec.prefix}:${spec.keyOf(item)}`} plain onPress={() => spec.onPick(item)}>
              {pad(clip(full, room - used - 1), room - used)}
            </Button>
            {isClipped ? hoverCard(`${spec.prefix}-card:${spec.keyOf(item)}`, full, used) : null}
          </Box>
        )
      })
      if (!hasBar) return <Box flexDirection="column">{rows}</Box>

      // The scroll column: ▲, a track with the thumb, ▼; one cell per row.
      const track = size - 2
      const thumb = Math.max(1, Math.round((track * size) / total))
      const thumbAt = last === 0 ? 0 : Math.round(((track - thumb) * start) / last)
      const atTop = start === 0
      const atEnd = start >= last
      return (
        <Box flexDirection="column">
          <Box flexDirection="row">
            <Box flexDirection="column">{rows}</Box>
            <Text> </Text>
            <Box flexDirection="column">
              <Button key={`${spec.prefix}-up`} plain dimColor={atTop} onPress={() => scrollTo(start - (LIST_ROWS - 1))}>▲</Button>
              {Array.from({ length: track }, (_, i) => (
                <Text key={`${spec.prefix}-track-${i}`} dimColor={i < thumbAt || i >= thumbAt + thumb}>
                  {i >= thumbAt && i < thumbAt + thumb ? '┃' : '│'}
                </Text>
              ))}
              <Button key={`${spec.prefix}-down`} plain dimColor={atEnd} onPress={() => scrollTo(start + (LIST_ROWS - 1))}>▼</Button>
            </Box>
          </Box>
          <Text dimColor wrap="truncate-end">{`  ${start + 1}–${start + size} of ${total} ${spec.noun.many} · ▲ ▼ scroll`}</Text>
        </Box>
      )
    }

    /**
     * A list folded into one framed row showing the current entry: a press on
     * the row opens it below, another press or a pick folds it again.
     */
    const foldable = <T,>(spec: Parameters<typeof rowList<T>>[0] & { which: Expandable; label: string; current: string }) => {
      const isOpen = open === spec.which
      const head = pad(`${spec.label}${clip(spec.current, inner - spec.label.length - 3)}`, inner - 2)
      return (
        <Box flexDirection="column" borderStyle="round" borderDimColor>
          <Button key={`${spec.which}-toggle`} plain onPress={() => void update($, expanded, now => (now === spec.which ? null : spec.which))}>
            {`${head}${isOpen ? ' ▴' : ' ▾'}`}
          </Button>
          {isOpen
            ? rowList({
                ...spec,
                onPick: item => {
                  void update($, expanded, () => null)
                  spec.onPick(item)
                },
              })
            : null}
        </Box>
      )
    }

    const fileName = (one: ChangedFile) => (one.oldPath && one.oldPath !== one.path ? `${one.oldPath} → ${one.path}` : one.path)
    const fileText = (one: ChangedFile) => `${fileName(one)}  ${one.isBinary ? 'binary' : `+${one.added} −${one.deleted}`}`

    const header = (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold>
            <Text color={COLOR.petal}>✿</Text> {clip(baseName(snap.repoRoot), width - 16)}
          </Text>
          <Button key="refresh" hotkey="r" onPress={() => void load($, 'repo')}>Refresh</Button>
          {debugButton}
        </Box>
        <Text dimColor wrap="truncate-end">{snap.isLoading ? 'Loading…' : sel.isFollowing ? 'Following the newest commit' : 'Pinned to a past commit'}</Text>
        {snap.error ? <Text color="red">{snap.error}</Text> : null}
      </Box>
    )

    // Which commits the list starts from: every option the worktree offers, one
    // button each, the chosen one primary. Hidden where only the whole history is on offer.
    const rangeOptions: { mode: RangeMode; label: string }[] = [
      { mode: 'all', label: 'all' },
      ...(snap.ranges.notInDefault ? [{ mode: 'notInDefault' as const, label: `not in ${snap.ranges.notInDefault.ref} · ${snap.ranges.notInDefault.count}` }] : []),
      ...(snap.ranges.base ? [{ mode: 'base' as const, label: `since ${snap.ranges.base.ref} · ${snap.ranges.base.count}` }] : []),
    ]
    const rangeRow =
      rangeOptions.length < 2 ? null : (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text dimColor>Commits  </Text>
          {rangeOptions.map(option => (
            <Button
              key={`range-${option.mode}`}
              variant={snap.range === option.mode ? 'primary' : undefined}
              dimColor={snap.range !== option.mode}
              onPress={() => void load($, 'commit', { range: option.mode, commit: null, file: null })}
            >
              {option.label}
            </Button>
          ))}
        </Box>
      )

    const worktreeAt = snap.worktrees.findIndex(wt => wt.path === worktree?.path)
    const worktreePicker = foldable({
      which: 'worktree',
      prefix: 'worktree',
      label: 'Worktree  ',
      current: worktree ? worktreeLabel(worktree) : 'none',
      items: snap.worktrees,
      at: worktreeAt,
      keyOf: wt => wt.path,
      textOf: worktreeLabel,
      noun: { one: 'worktree', many: 'worktrees' },
      onPick: wt => void load($, 'repo', { worktree: wt.path, commit: null, file: null }),
    })

    // A worktree with no commits yet: the welcome art, until the first one lands.
    // Nothing to walk: the welcome art, until a commit lands. Under "not in
    // default" that is the default branch itself (no work happens there) or a
    // branch level with it; otherwise a worktree with no commits at all.
    if (snap.commits.length === 0) {
      const where = worktree?.branch ?? 'this worktree'
      const defaultRef = snap.ranges.notInDefault?.ref ?? 'the default branch'
      const isNotInDefault = snap.range === 'notInDefault'
      const showAll = (
        <Box>
          <Button key="show-all" hotkey="h" onPress={() => void load($, 'commit', { range: 'all', commit: null, file: null })}>
            Show all commits
          </Button>
        </Box>
      )
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          {debugSection()}
          {worktreePicker}
          {rangeRow}
          {welcome()}
          {isNotInDefault && snap.ranges.isOnDefault ? (
            <Box flexDirection="column" gap={1}>
              <Text>You're on {where}. Work happens on branches, so there is nothing new to walk here.</Text>
              <Text dimColor>Pick a worktree above, or show the whole history.</Text>
              {showAll}
            </Box>
          ) : isNotInDefault ? (
            <Box flexDirection="column" gap={1}>
              <Text>No commits on {where} beyond {defaultRef} yet.</Text>
              <Text dimColor>The pane follows the first one as soon as it lands. Press r to look again.</Text>
              {showAll}
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text>No commits on {where} yet.</Text>
              <Text dimColor>The pane follows the first one as soon as it lands. Press r to look again.</Text>
            </Box>
          )}
        </Box>
      )
    }

    // The debug section sits under the header here: below the diff it would be off screen.
    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {debugSection()}
        {worktreePicker}

        <Box flexDirection="column">
          {rangeRow}
          {foldable({
            which: 'commit',
            prefix: 'commit',
            label: 'Commit    ',
            current: commit ? commitLabel(commit) : 'none',
            items: snap.commits,
            at: commitAt,
            keyOf: one => one.sha,
            textOf: commitLabel,
            noun: { one: 'commit', many: 'commits' },
            onPick: one => void load($, 'commit', { commit: one.sha, file: null }),
          })}
          {commit ? (
            <Text dimColor wrap="truncate-end">
              {commit.author} · {commit.when}
              {commit.parents.length > 1 ? ' · merge, against its first parent' : ''}
              {commit.parents.length === 0 ? ' · root commit' : ''}
              {` · ${commitAt + 1} of ${snap.commits.length}`}
            </Text>
          ) : null}
          <Box flexDirection="row" gap={1}>
            <Button key="older" hotkey="o" dimColor={commitAt >= snap.commits.length - 1} onPress={() => void stepCommit($, 1)}>Older</Button>
            <Button key="newer" hotkey="n" dimColor={commitAt <= 0} onPress={() => void stepCommit($, -1)}>Newer</Button>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text>Files     </Text>
            <Button key="prev-file" hotkey="k" dimColor={fileAt <= 0} onPress={() => void stepFile($, -1)}>Prev</Button>
            <Button key="next-file" hotkey="j" dimColor={fileAt < 0 || fileAt >= snap.files.length - 1} onPress={() => void stepFile($, 1)}>Next</Button>
            <Text dimColor>{snap.files.length > 0 ? `${fileAt + 1} of ${snap.files.length}` : 'none'}</Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderDimColor>
            {rowList({
              prefix: 'file',
              items: snap.files,
              at: fileAt,
              keyOf: one => one.path,
              tagOf: one => ({ text: one.status, color: STATUS_COLOR[one.status] }),
              textOf: fileText,
              noun: { one: 'file', many: 'files' },
              onPick: one => void load($, 'content', { file: one.path }),
            })}
          </Box>
          {file && fileText(file).length > inner - (snap.files.length > LIST_ROWS ? 2 : 0) - 6 ? (
            // The selected file's whole name when its row is cut: renames and deep paths, for every surface and the keyboard.
            <Text dimColor wrap="wrap">{`▶ ${fileName(file)}`}</Text>
          ) : null}
        </Box>

        <Box flexDirection="row" gap={1}>
          {mode('diff', 'Diff', 'd')}
          {mode('after', 'After', 'a')}
          {mode('before', 'Before', 'b')}
        </Box>

        {content === null ? null : content.kind === 'note' ? (
          <Text dimColor>{content.text}</Text>
        ) : (
          <Box flexDirection="column">
            {content.kind === 'diff' && content.context === 'near' ? (
              <Text dimColor>Too large for the whole file: showing the changes with 20 lines of context.</Text>
            ) : null}
            {content.kind === 'diff' ? (
              <Code source={content.source} format="diff" path={file?.path} />
            ) : (
              <Code source={content.source} path={content.path} startLine={1} />
            )}
            {content.isTruncated ? <Text dimColor>Cut here to fit the pane; open the file to read the rest.</Text> : null}
          </Box>
        )}

        <Text dimColor wrap="truncate-end">keys: o/n commit · k/j file · d/a/b view · r refresh · x debug · Esc close</Text>
      </Box>
    )
  })
}

