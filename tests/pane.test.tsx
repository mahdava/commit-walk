import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'commit-walk',
  props: { title: 'Commit walk', isFocused: true, bodyColumns: 84, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} },
} as const

type FakeCommit = { sha: string; parents: string[]; subject: string; files: { status: string; path: string; added: number; deleted: number }[] }

const sha = (c: string) => c.repeat(40)
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** A small repository: two worktrees; `main` has three commits, newest first. */
function scenario() {
  const main: FakeCommit[] = [
    { sha: sha('c'), parents: [sha('b')], subject: 'Change b', files: [{ status: 'M', path: 'src/b.ts', added: 1, deleted: 1 }, { status: 'A', path: 'src/new.ts', added: 1, deleted: 0 }] },
    { sha: sha('b'), parents: [sha('a')], subject: 'Add b', files: [{ status: 'A', path: 'src/b.ts', added: 2, deleted: 0 }] },
    { sha: sha('a'), parents: [], subject: 'Root', files: [{ status: 'A', path: 'README.md', added: 1, deleted: 0 }] },
  ]
  const side: FakeCommit[] = [{ sha: sha('d'), parents: [sha('c')], subject: 'Side work', files: [{ status: 'M', path: 'side.ts', added: 1, deleted: 0 }] }]
  return { logs: { '/repo': main, '/repo-side': side } as Record<string, FakeCommit[]>, runs: [] as string[] }
}

type World = ReturnType<typeof scenario>

function fakeGit(world: World, cwd: string, args: readonly string[]) {
  const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '' })
  world.runs.push(`${cwd}: ${args.join(' ')}`)
  const all = Object.values(world.logs).flat()
  const commitOf = (s: string | undefined) => all.find(c => c.sha === s)
  switch (args[0]) {
    case 'rev-parse':
      return cwd === '/nowhere' ? { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git' } : ok('/repo\n')
    case 'worktree':
      return ok([`worktree /repo`, `HEAD ${sha('c')}`, `branch refs/heads/main`, ``, `worktree /repo-side`, `HEAD ${sha('d')}`, `branch refs/heads/side`, ``].join('\0'))
    case 'log':
      return ok((world.logs[cwd] ?? []).map(c => [c.sha, c.sha.slice(0, 7), c.parents.join(' '), 'Lucia', '1 hour ago', c.subject].join('\x1f')).join('\0'))
    case 'hash-object':
      return ok(`${EMPTY_TREE}\n`)
    case 'diff-tree': {
      // The commit is the last revision before the pathspec: `diff-tree … <base> <sha> [-- paths]`.
      const end = args.includes('--') ? args.indexOf('--') : args.length
      const target = commitOf(args.slice(0, end).reverse().find(arg => commitOf(arg) !== undefined))
      if (!target) return { exitCode: 128, stdout: '', stderr: 'fatal: bad object' }
      if (args.includes('--name-status')) return ok(target.files.flatMap(f => [f.status, f.path]).join('\0') + '\0')
      if (args.includes('--numstat')) return ok(target.files.map(f => `${f.added}\t${f.deleted}\t${f.path}`).join('\0') + '\0')
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
function engine(on: any, world: World, cwd = '/repo') {
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

async function openPane($: any, surface: 'terminal' | 'desktop' | 'mobile', cwd = '/repo') {
  await $.session.start({ cwd, surface, isInteractive: true })
  const answer = await $.command.run({ command: 'commits', args: '', origin: { kind: 'user' }, presentation: {} })
  const ui = await $.ui.mount({ plugin: 'commit-walk', surface, ...PANE })
  return { ui, answer }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`opens on the newest commit of the session's worktree and walks it (${surface})`, async ($, on) => {
    const world = scenario()
    engine(on, world)
    const { ui, answer } = await openPane($, surface)
    expect(answer.text).toBe('Commit walk opened.')

    expect((await ui.find({ key: 'worktree' }))?.props.value).toBe('/repo')
    expect((await ui.find({ key: 'commit' }))?.props.value).toBe(sha('c'))
    expect((await ui.find({ key: 'file' }))?.props.value).toBe('src/b.ts')
    const diff = await ui.find({ type: 'Code' })
    expect(diff?.props.format).toBe('diff')
    expect(diff?.props.source).toBe('@@ -1 +1 @@\n-old line\n+new line in Change b')
    expect(await ui.find({ type: 'Text', text: /Following the newest commit/ })).toBeDefined()

    await ui.press({ key: 'next-file' })
    expect((await ui.find({ key: 'file' }))?.props.value).toBe('src/new.ts')

    await ui.press({ key: 'mode-after' })
    const after = await ui.find({ type: 'Code' })
    expect(after?.props.format).toBeUndefined()
    expect(after?.props.startLine).toBe(1)
    expect(after?.props.source).toBe(`content of src/new.ts at ${sha('c').slice(0, 7)}`)

    await ui.press({ key: 'mode-before' })
    expect(await ui.find({ type: 'Text', text: /did not exist before this commit/ })).toBeDefined()

    await ui.press({ key: 'older' })
    expect((await ui.find({ key: 'commit' }))?.props.value).toBe(sha('b'))
    expect((await ui.find({ key: 'file' }))?.props.value).toBe('src/b.ts')
    expect(await ui.find({ type: 'Text', text: /Pinned to a past commit/ })).toBeDefined()

    await ui.select({ key: 'commit', value: sha('a') })
    expect(await ui.find({ type: 'Text', text: /root commit/ })).toBeDefined()
    await ui.unmount()
  })
}

test('another worktree reads its own log', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  await ui.select({ key: 'worktree', value: '/repo-side' })
  expect((await ui.find({ key: 'commit' }))?.props.value).toBe(sha('d'))
  expect((await ui.find({ key: 'file' }))?.props.value).toBe('side.ts')
  expect(world.runs.some(run => run.startsWith('/repo-side: log'))).toBe(true)
  await ui.unmount()
})

test('a refresh follows a new commit while following, and keeps a pinned one', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  world.logs['/repo']!.unshift({ sha: sha('e'), parents: [sha('c')], subject: 'Newer still', files: [{ status: 'M', path: 'src/b.ts', added: 1, deleted: 1 }] })
  await ui.press({ key: 'refresh' })
  expect((await ui.find({ key: 'commit' }))?.props.value).toBe(sha('e'))

  await ui.press({ key: 'older' })
  world.logs['/repo']!.unshift({ sha: sha('f'), parents: [sha('e')], subject: 'Newest', files: [{ status: 'M', path: 'x.ts', added: 1, deleted: 0 }] })
  await ui.press({ key: 'refresh' })
  expect((await ui.find({ key: 'commit' }))?.props.value).toBe(sha('c'))
  await ui.unmount()
})

test('outside a repository the pane says so', async ($, on) => {
  const world = scenario()
  engine(on, world, '/nowhere')
  const { ui } = await openPane($, 'terminal', '/nowhere')
  expect(await ui.find({ type: 'Text', text: /No repository to review/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /not a git repository/ })).toBeDefined()
  await ui.unmount()
})

test('a surface without Select still draws and steps', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const { ui } = await openPane($, 'mobile')
  expect(await ui.find({ key: 'commit' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Change b/ })).toBeDefined()
  await ui.press({ key: 'older' })
  expect(await ui.find({ type: 'Text', text: /Add b/ })).toBeDefined()
  await ui.unmount()
})

test('/commits closes an open pane and explains unknown arguments', async ($, on) => {
  const world = scenario()
  const fake = engine(on, world)
  await openPane($, 'terminal')
  expect(fake.panes.length).toBe(1)
  const closed = await $.command.run({ command: 'commits', args: '', origin: { kind: 'user' }, presentation: {} } as never)
  expect(closed.text).toBe('Commit walk closed.')
  expect(fake.panes.length).toBe(0)
  const odd = await $.command.run({ command: 'commits', args: 'sideways', origin: { kind: 'user' }, presentation: {} } as never)
  expect(odd.text).toBe('Usage: /commits [refresh|close]')
})

test('an edit by Claude refreshes the open pane; a read-only command does not', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const clock = mock.clock(on)
  on('tool.call', (_$: unknown, e: { tool: string }) => ({ result: { ok: true }, ...(e.tool === 'Bash' ? { isReadOnly: true } : {}) }) as never)
  const { ui } = await openPane($, 'terminal')
  const logs = () => world.runs.filter(run => run.includes(': log ')).length
  const before = logs()

  await $.tool.call({ tool: 'Bash', input: { command: 'git status' }, tool_use_id: 'toolu_read' } as never)
  await clock.advance(1000)
  expect(logs()).toBe(before)

  world.logs['/repo']!.unshift({ sha: sha('e'), parents: [sha('c')], subject: 'Made by Claude', files: [{ status: 'M', path: 'src/b.ts', added: 1, deleted: 1 }] })
  await $.tool.call({ tool: 'Edit', input: { file_path: '/repo/src/b.ts', old_string: 'a', new_string: 'b' }, tool_use_id: 'toolu_edit' } as never)
  expect(logs()).toBe(before)
  await clock.advance(1000)
  expect(logs()).toBe(before + 1)
  expect((await ui.find({ key: 'commit' }))?.props.value).toBe(sha('e'))
  await ui.unmount()
})
