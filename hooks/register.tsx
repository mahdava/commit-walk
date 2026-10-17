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

import type { ChangedFile, Commit, Content, Expandable, Selection, Snapshot, ViewMode, Worktree } from '../types'
import { createRepo, type GitRun, type Repo } from './git'
import { COMMIT_LINE, DIM_TONES, LARGE, MEDIUM, SMALL, TONE_COLOR, artRuns, type Art } from './welcome'
import { windowAround } from './window'

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

const INITIAL_SELECTION: Selection = { worktree: null, commit: null, file: null, mode: 'diff', isFollowing: true }
const EMPTY_SNAPSHOT: Snapshot = {
  repoRoot: null,
  worktrees: [],
  commits: [],
  files: [],
  content: null,
  isLoading: false,
  error: null,
  loadedAt: null,
}

const selection = atom({ plugin: 'commit-walk', key: 'selection' } as const, INITIAL_SELECTION)
const snapshot = atom({ plugin: 'commit-walk', key: 'snapshot' } as const, EMPTY_SNAPSHOT)
const expanded = atom({ plugin: 'commit-walk', key: 'expanded' } as const, null as Expandable | null)

/** The session's working directory: where the repository is looked for. */
let sessionCwd = ''
/** Bumped by every load; a load whose ticket is no longer current writes nothing. */
let generation = 0
let refreshTimer: { cancel(): void } | null = null

// ── Git through the host ─────────────────────────────────────────────────

function repoFor($: EngineInterface): Repo {
  return createRepo(async (cwd, args): Promise<GitRun> => {
    // No optional locks: reading must never contend with an agent's index writes.
    const result = await $.process.run(['git', '-c', 'core.quotepath=off', '--no-pager', ...args], {
      cwd,
      timeoutMs: GIT_TIMEOUT_MS,
      env: { GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat', LC_ALL: 'C' },
    })
    return result
  })
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
  let { repoRoot, worktrees, commits, files } = before
  try {
    const repo = repoFor($)

    if (depth === 'repo' || repoRoot === null) {
      repoRoot = await repo.toplevel(sessionCwd || '.')
      worktrees = await repo.worktrees(repoRoot)
    }
    const worktree = chooseWorktree(worktrees, want.worktree, repoRoot)
    if (!worktree) throw new Error('No worktree to show.')
    const isNewWorktree = worktree.path !== was.worktree

    if (depth === 'repo' || repoRoot !== before.repoRoot || isNewWorktree) {
      commits = await repo.log(worktree.path)
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
    }))
    await update($, snapshot, () => ({
      repoRoot,
      worktrees,
      commits,
      files,
      content,
      isLoading: false,
      error: null,
      loadedAt: Date.now(),
    }))
  } catch (cause) {
    if (ticket !== generation) return
    const reached = { repoRoot, worktrees, commits }
    await update($, snapshot, snap => ({ ...snap, ...reached, isLoading: false, error: messageOf(cause) }))
  }
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
    // Named after the plugin. (/review is refused: it is an alias of the built-in /code-review.)
    try {
      await $.command.register({
        name: 'commit-walk',
        description: 'Open or close the commit walk pane: worktrees, commits and files of this repository',
        argumentHint: '[refresh|close]',
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
    if (arg !== '' && arg !== 'refresh') return { text: 'Usage: /commit-walk [refresh|close]' }

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
    const width = Math.max(24, e.props.bodyColumns)

    // The sunflower over a commit line, centred: the largest that fits the pane
    // with room for the message under it, else a one-line mark.
    const rows = e.props.scroll.bodyRows
    const centred = (source: Art, row: number, key: string) => (
      <Text key={key} wrap="truncate-end">
        {' '.repeat(Math.max(0, Math.floor((width - source.width) / 2)))}
        {artRuns(source, row).map((run, i) =>
          run.tone === null ? (
            run.text
          ) : (
            <Text key={`r${i}`} color={TONE_COLOR[run.tone]} dimColor={DIM_TONES.has(run.tone)}>
              {run.text}
            </Text>
          ),
        )}
      </Text>
    )
    const welcome = () => {
      const fits = (art: Art, roomBelow: number) => width >= art.width + 2 && rows >= art.rows.length + roomBelow
      const source = fits(LARGE, 10) ? LARGE : fits(MEDIUM, 10) ? MEDIUM : width >= SMALL.width + 2 ? SMALL : null
      if (source === null) {
        return (
          <Text bold color={TONE_COLOR.leaf}>
            <Text color={TONE_COLOR.petal}>✿</Text> Commit Walk
          </Text>
        )
      }
      const title = 'Commit Walk'
      return (
        <Box flexDirection="column">
          {source.rows.map((_, row) => centred(source, row, `art-${row}`))}
          {source === SMALL ? null : centred(COMMIT_LINE, 0, 'art-line')}
          <Text> </Text>
          <Text bold color={TONE_COLOR.leaf}>
            {' '.repeat(Math.max(0, Math.floor((width - title.length) / 2)))}
            {title}
          </Text>
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
          <Box>
            <Button key="refresh" hotkey="r" onPress={() => void load($, 'repo')}>Try again</Button>
          </Box>
        </Box>
      )
    }
    if (snap.repoRoot === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {welcome()}
          <Text dimColor>Reading the repository…</Text>
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
     * Rows of a list around the selected entry, LIST_ROWS at a time, with an
     * edge row at either end that pages. Each row: a ▶ on the selected one, an
     * optional coloured tag, the entry's text.
     */
    const rowList = <T,>(spec: {
      prefix: string
      items: readonly T[]
      at: number
      keyOf: (item: T) => string
      tagOf?: (item: T) => { text: string; color: string | undefined }
      textOf: (item: T) => string
      noun: { one: string; many: string; before: string; after: string }
      onPick: (item: T) => void
    }) => {
      const win = windowAround(spec.items, spec.at, LIST_ROWS + 2)
      const edge = (side: 'before' | 'after', count: number, target: number) => (
        <Button key={`${spec.prefix}-${side}`} plain dimColor onPress={() => {
          const item = spec.items[target]
          if (item !== undefined) spec.onPick(item)
        }}>
          {pad(`  ${side === 'before' ? '↑' : '↓'} ${count} ${spec.noun[side]} ${count === 1 ? spec.noun.one : spec.noun.many}`)}
        </Button>
      )
      return [
        win.before > 0 ? edge('before', win.before, win.start - 1) : null,
        ...win.items.map((item, i) => {
          const isSelected = win.start + i === spec.at
          const tag = spec.tagOf?.(item)
          const used = 2 + (tag ? tag.text.length + 2 : 0)
          return (
            <Button key={`${spec.prefix}:${spec.keyOf(item)}`} label={spec.keyOf(item)} plain onPress={() => spec.onPick(item)}>
              <Text color={isSelected ? TONE_COLOR.petal : undefined} bold={isSelected}>{isSelected ? '▶ ' : '  '}</Text>
              {tag ? <Text color={tag.color}>{tag.text}  </Text> : null}
              <Text bold={isSelected}>{pad(clip(spec.textOf(item), inner - used - 1), inner - used)}</Text>
            </Button>
          )
        }),
        win.after > 0 ? edge('after', win.after, win.start + win.items.length) : null,
      ]
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
            <Text>{head}</Text>
            <Text dimColor>{isOpen ? ' ▴' : ' ▾'}</Text>
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

    const header = (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold>
            <Text color={TONE_COLOR.petal}>✿</Text> {clip(baseName(snap.repoRoot), width - 16)}
          </Text>
          <Button key="refresh" hotkey="r" onPress={() => void load($, 'repo')}>Refresh</Button>
        </Box>
        <Text dimColor wrap="truncate-end">{snap.isLoading ? 'Loading…' : sel.isFollowing ? 'Following the newest commit' : 'Pinned to a past commit'}</Text>
        {snap.error ? <Text color="red">{snap.error}</Text> : null}
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
      noun: { one: 'worktree', many: 'worktrees', before: 'more', after: 'more' },
      onPick: wt => void load($, 'repo', { worktree: wt.path, commit: null, file: null }),
    })

    // A worktree with no commits yet: the welcome art, until the first one lands.
    if (snap.commits.length === 0) {
      const where = worktree?.branch ?? 'this worktree'
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          {worktreePicker}
          {welcome()}
          <Text>No commits on {where} yet.</Text>
          <Text dimColor>The pane follows the first one as soon as it lands. Press r to look again.</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {worktreePicker}

        <Box flexDirection="column">
          {foldable({
            which: 'commit',
            prefix: 'commit',
            label: 'Commit    ',
            current: commit ? commitLabel(commit) : 'none',
            items: snap.commits,
            at: commitAt,
            keyOf: one => one.sha,
            textOf: commitLabel,
            noun: { one: 'commit', many: 'commits', before: 'newer', after: 'older' },
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
              textOf: one => {
                const name = one.oldPath && one.oldPath !== one.path ? `${one.oldPath} → ${one.path}` : one.path
                return `${name}  ${one.isBinary ? 'binary' : `+${one.added} −${one.deleted}`}`
              },
              noun: { one: 'file', many: 'files', before: 'earlier', after: 'more' },
              onPick: one => void load($, 'content', { file: one.path }),
            })}
          </Box>
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

        <Text dimColor wrap="truncate-end">keys: o/n commit · k/j file · d/a/b view · r refresh · Esc close</Text>
      </Box>
    )
  })
}

