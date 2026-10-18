// Opening the pane and walking it: worktrees, commits, files, refreshes and the command.

import { expect, mock, test } from 'claude-code/testing'

import { sha, scenario, engine, rowsOf, selectedFile, current, pickFrom, openPane } from './support'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`opens on the newest commit of the session's worktree and walks it (${surface})`, async ($, on) => {
    const world = scenario()
    engine(on, world)
    const { ui, answer } = await openPane($, surface)
    expect(answer.text).toBe('Commit walk opened.')

    expect(await current(ui, 'worktree')).toMatch(/main/)
    expect(await current(ui, 'commit')).toMatch(/ccccccc {2}Change b/)
    expect(await selectedFile(ui)).toBe('src/b.ts')
    const diff = await ui.find({ type: 'Code' })
    expect(diff?.props.format).toBe('diff')
    expect(diff?.props.source).toBe('@@ -1 +1 @@\n-old line\n+new line in Change b')
    expect(await ui.find({ type: 'Text', text: /Following the newest commit/ })).toBeDefined()

    await ui.press({ key: 'next-file' })
    expect(await selectedFile(ui)).toBe('src/new.ts')

    await ui.press({ key: 'mode-after' })
    const after = await ui.find({ type: 'Code' })
    expect(after?.props.format).toBeUndefined()
    expect(after?.props.startLine).toBe(1)
    expect(after?.props.source).toBe(`content of src/new.ts at ${sha('c').slice(0, 7)}`)

    await ui.press({ key: 'mode-before' })
    expect(await ui.find({ type: 'Text', text: /did not exist before this commit/ })).toBeDefined()

    await ui.press({ key: 'older' })
    expect(await current(ui, 'commit')).toMatch(/bbbbbbb/)
    expect(await selectedFile(ui)).toBe('src/b.ts')
    expect(await ui.find({ type: 'Text', text: /Pinned to a past commit/ })).toBeDefined()

    await pickFrom(ui, 'commit', sha('a'))
    expect(await ui.find({ type: 'Text', text: /root commit/ })).toBeDefined()
    expect(await rowsOf(ui, 'commit')).toEqual([])
    await ui.unmount()
  })
}

test('another worktree reads its own log', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  await pickFrom(ui, 'worktree', '/repo-side')
  expect(await current(ui, 'commit')).toMatch(/ddddddd/)
  expect(await selectedFile(ui)).toBe('side.ts')
  expect(world.runs.some(run => run.startsWith('/repo-side: log'))).toBe(true)
  await ui.unmount()
})

test('a refresh follows a new commit while following, and keeps a pinned one', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  world.logs['/repo']!.unshift({ sha: sha('e'), parents: [sha('c')], subject: 'Newer still', files: [{ status: 'M', path: 'src/b.ts', added: 1, deleted: 1 }] })
  await ui.press({ key: 'refresh' })
  expect(await current(ui, 'commit')).toMatch(/eeeeeee/)

  await ui.press({ key: 'older' })
  world.logs['/repo']!.unshift({ sha: sha('f'), parents: [sha('e')], subject: 'Newest', files: [{ status: 'M', path: 'x.ts', added: 1, deleted: 0 }] })
  await ui.press({ key: 'refresh' })
  expect(await current(ui, 'commit')).toMatch(/ccccccc/)
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

test('mobile draws the same foldable lists and steps', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const { ui } = await openPane($, 'mobile')
  expect(await ui.find({ key: 'commit-toggle' })).toBeDefined()
  expect(await current(ui, 'commit')).toMatch(/Change b/)
  await ui.press({ key: 'older' })
  expect(await current(ui, 'commit')).toMatch(/Add b/)
  await ui.unmount()
})

test('/commit-walk closes an open pane and explains unknown arguments', async ($, on) => {
  const world = scenario()
  const fake = engine(on, world)
  await openPane($, 'terminal')
  expect(fake.panes.length).toBe(1)
  const closed = await $.command.run({ command: 'commit-walk', args: '', origin: { kind: 'user' }, presentation: {} } as never)
  expect(closed.text).toBe('Commit walk closed.')
  expect(fake.panes.length).toBe(0)
  const odd = await $.command.run({ command: 'commit-walk', args: 'sideways', origin: { kind: 'user' }, presentation: {} } as never)
  expect(odd.text).toBe('Usage: /commit-walk [refresh|close|debug]')
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
  expect(await current(ui, 'commit')).toMatch(/eeeeeee/)
  await ui.unmount()
})
