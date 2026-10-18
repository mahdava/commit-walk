// What the pane tests share: a fake repository and the git that answers for
// it, the engine beneath the plugin, and helpers that read the drawing.

export const PANE = {
  component: 'Pane',
  requestId: 'commit-walk',
  props: { title: 'Commit walk', isFocused: true, bodyColumns: 84, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} },
} as const

export type FakeCommit = { sha: string; parents: string[]; subject: string; files: { status: string; path: string; oldPath?: string; added: number; deleted: number }[] }

export const sha = (c: string) => c.repeat(40)
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** A small repository: two worktrees; `main` has three commits, newest first. */
export function scenario() {
  const main: FakeCommit[] = [
    { sha: sha('c'), parents: [sha('b')], subject: 'Change b', files: [{ status: 'M', path: 'src/b.ts', added: 1, deleted: 1 }, { status: 'A', path: 'src/new.ts', added: 1, deleted: 0 }] },
    { sha: sha('b'), parents: [sha('a')], subject: 'Add b', files: [{ status: 'A', path: 'src/b.ts', added: 2, deleted: 0 }] },
    { sha: sha('a'), parents: [], subject: 'Root', files: [{ status: 'A', path: 'README.md', added: 1, deleted: 0 }] },
  ]
  const side: FakeCommit[] = [{ sha: sha('d'), parents: [sha('c')], subject: 'Side work', files: [{ status: 'M', path: 'side.ts', added: 1, deleted: 0 }] }]
  return {
    logs: { '/repo': main, '/repo-side': side } as Record<string, FakeCommit[]>,
    runs: [] as string[],
    /** The branch each worktree is on. */
    branches: { '/repo': 'main', '/repo-side': 'side' } as Record<string, string>,
    /** origin/HEAD's target, or null for a clone without one. Off by default: most tests walk history. */
    originHead: null as string | null,
    /** The refs that exist, for `rev-parse --verify`. */
    refs: [] as string[],
    /** Per worktree, `rev-list --count <ref>..HEAD` per ref: HEAD's commits the ref lacks. */
    ahead: {} as Record<string, Record<string, number>>,
    /** Per worktree, `for-each-ref … ahead-behind:HEAD` lines: `<branch>\t<theirs> <mine>`. */
    distances: {} as Record<string, string>,
  }
}

export type World = ReturnType<typeof scenario>

export function fakeGit(world: World, cwd: string, args: readonly string[]) {
  const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '' })
  world.runs.push(`${cwd}: ${args.join(' ')}`)
  const all = Object.values(world.logs).flat()
  const commitOf = (s: string | undefined) => all.find(c => c.sha === s)
  switch (args[0]) {
    case 'rev-parse':
      if (cwd === '/nowhere') return { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git' }
      if (args[1] === '--verify') return world.refs.includes(args[args.length - 1] ?? '') ? ok(`${sha('c')}\n`) : { exitCode: 1, stdout: '', stderr: '' }
      return ok('/repo\n')
    case 'branch':
      return ok(`${world.branches[cwd] ?? ''}\n`)
    case 'symbolic-ref':
      return world.originHead ? ok(`${world.originHead}\n`) : { exitCode: 1, stdout: '', stderr: '' }
    case 'rev-list': {
      const ref = (args[args.length - 1] ?? '').replace(/\.\.HEAD$/, '')
      return ok(`${world.ahead[cwd]?.[ref] ?? 0}\n`)
    }
    case 'for-each-ref':
      return ok(world.distances[cwd] ?? '')
    case 'worktree':
      return ok([`worktree /repo`, `HEAD ${sha('c')}`, `branch refs/heads/main`, ``, `worktree /repo-side`, `HEAD ${sha('d')}`, `branch refs/heads/side`, ``].join('\0'))
    case 'log': {
      // `<ref>..HEAD` lists HEAD's newest commits the ref lacks.
      const since = args.find(arg => arg.endsWith('..HEAD'))?.replace(/\.\.HEAD$/, '')
      const commits = (world.logs[cwd] ?? []).slice(0, since === undefined ? undefined : (world.ahead[cwd]?.[since] ?? 0))
      return ok(commits.map(c => [c.sha, c.sha.slice(0, 7), c.parents.join(' '), 'Lucia', '1 hour ago', c.subject].join('\x1f')).join('\0'))
    }
    case 'hash-object':
      return ok(`${EMPTY_TREE}\n`)
    case 'diff-tree': {
      // The commit is the last revision before the pathspec: `diff-tree … <base> <sha> [-- paths]`.
      const end = args.includes('--') ? args.indexOf('--') : args.length
      const target = commitOf(args.slice(0, end).reverse().find(arg => commitOf(arg) !== undefined))
      if (!target) return { exitCode: 128, stdout: '', stderr: 'fatal: bad object' }
      // Renames as git writes them: a score and both paths; numstat names both after an empty path.
      if (args.includes('--name-status')) return ok(target.files.flatMap(f => (f.oldPath ? [`${f.status}100`, f.oldPath, f.path] : [f.status, f.path])).join('\0') + '\0')
      if (args.includes('--numstat')) return ok(target.files.map(f => (f.oldPath ? `${f.added}\t${f.deleted}\t\0${f.oldPath}\0${f.path}` : `${f.added}\t${f.deleted}\t${f.path}`)).join('\0') + '\0')
      const path = args[args.length - 1] ?? ''
      return ok(`diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old line\n+new line in ${target.subject}\n`)
    }
    case 'cat-file': {
      const spec = args[args.length - 1] ?? ''
      return args[1] === '-s' ? ok('24\n') : ok(`content of ${spec.split(':')[1]} at ${spec.slice(0, 7)}\n`)
    }
    default:
      return { exitCode: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` }
  }
}

/** Answers what the engine would beneath the plugin: git, panes, timers, the command registry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the kit's `on` is generic per event
export function engine(on: any, world: World, cwd = '/repo') {
  const panes: { id: string; title: string }[] = []
  on('process.run', (_$: unknown, e: { argv: readonly string[]; init?: { cwd?: string } }) => {
    const args = e.argv.slice(1).filter((a, i, list) => !(a === '-c' || list[i - 1] === '-c' || a === '--no-pager'))
    return { value: fakeGit(world, e.init?.cwd ?? cwd, args) }
  })
  on('session.start', (_$: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', (_$: unknown, e: { id: string; title?: string }) => {
    if (!panes.some(p => p.id === e.id)) panes.push({ id: e.id, title: e.title ?? e.id })
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$: unknown, e: { id: string }) => {
    const at = panes.findIndex(p => p.id === e.id)
    if (at >= 0) panes.splice(at, 1)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: panes.map(p => ({ ...p, isShown: true, isFocused: true, isPlaced: true })) }))
  return { panes, start: cwd }
}

export type Drawing = {
  find: (q: { key: string }) => Promise<{ text?: string } | undefined>
  findAll: (q: { type: 'Button' }) => Promise<readonly { key?: string; text?: string }[]>
}

/** The rows a list draws: the buttons keyed `<prefix>:<entry>`. */
export async function rowsOf(ui: Drawing, prefix: string) {
  return (await ui.findAll({ type: 'Button' })).filter((row: { key?: string }) => row.key?.startsWith(`${prefix}:`))
}

export type Node = { type?: string; props?: { key?: string }; children?: unknown[] }

/** The file the list marks as selected: the row whose ▶ marker stands before its `file:` button. */
export async function selectedFile(ui: Drawing & { drawn: () => Promise<unknown> }) {
  const walk = (node: unknown): string | undefined => {
    if (typeof node !== 'object' || node === null) return undefined
    const kids = ((node as Node).children ?? []) as Node[]
    const marker = kids[0]
    const button = kids.find(kid => kid?.type === 'Button' && kid.props?.key?.startsWith('file:'))
    if (marker?.type === 'Text' && JSON.stringify(marker).includes('▶') && button) return button.props!.key!.slice('file:'.length)
    for (const kid of kids) {
      const found = walk(kid)
      if (found) return found
    }
    return undefined
  }
  return walk(await ui.drawn())
}

/** What a folded list's row shows as its current entry. */
export async function current(ui: Drawing, which: 'worktree' | 'commit') {
  return (await ui.find({ key: `${which}-toggle` }))?.text ?? ''
}

/** Opens a folded list and picks an entry by its key. */
export async function pickFrom(ui: Drawing & { press: (t: { key: string }) => Promise<unknown> }, which: 'worktree' | 'commit', key: string) {
  await ui.press({ key: `${which}-toggle` })
  await ui.press({ key: `${which}:${key}` })
}

export async function openPane($: any, surface: 'terminal' | 'desktop' | 'mobile', cwd = '/repo') {
  await $.session.start({ cwd, surface, isInteractive: true })
  const answer = await $.command.run({ command: 'commit-walk', args: '', origin: { kind: 'user' }, presentation: {} })
  const ui = await $.ui.mount({ plugin: 'commit-walk', surface, ...PANE })
  return { ui, answer }
}
