// The uncommitted changes: the step after the newest commit and the commit
// list's first row, git's two letters on each file, the Staged and Unstaged
// labels above the code, After rebuilt from git, and following a commit.

import { expect, mock, test } from 'claude-code/testing'

import { sha, scenario, engine, rowsOf, selectedFile, current, openPane, type World } from './support'

/** A worktree with one file of each kind: staged, unstaged, both, and untracked. */
function pending(world: World) {
  world.pending['/repo'] = [
    { xy: 'M ', path: 'src/staged.ts', staged: '@@ -1 +1 @@\n-old staged\n+new staged' },
    { xy: ' M', path: 'src/edited.ts', unstaged: '@@ -1,2 +1,2 @@\n kept line\n-before edit\n+after edit' },
    { xy: 'MM', path: 'src/both.ts', staged: '@@ -1 +1 @@\n-v1\n+v2', unstaged: '@@ -1 +1 @@\n-v2\n+v3' },
    { xy: '??', path: 'notes/draft.md', lines: ['# Draft', 'first line'] },
  ]
  return world
}

const labels = async (ui: { findAll: (q: { type: 'Text' }) => Promise<readonly { text?: string }[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text ?? '').filter(text => /^✿ (Staged|Unstaged)/.test(text))

for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
  test(`Newer steps from the newest commit to the uncommitted changes and Older steps back (${surface})`, async ($, on) => {
    engine(on, pending(scenario()))
    const { ui } = await openPane($, surface)
    expect(await current(ui, 'commit')).toMatch(/ccccccc {2}Change b/)
    expect((await ui.find({ key: 'newer' }))?.text).toBe('Uncommitted')

    await ui.press({ key: 'newer' })
    expect(await current(ui, 'commit')).toMatch(/✿ Uncommitted changes · 4 files/)
    expect(await ui.find({ type: 'Text', text: /Not committed yet · 4 files/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Showing what is not committed yet/ })).toBeDefined()
    expect((await ui.find({ key: 'newer' }))?.text).toBe('Newer')
    expect(await selectedFile(ui)).toBe('src/staged.ts')

    await ui.press({ key: 'older' })
    expect(await current(ui, 'commit')).toMatch(/ccccccc {2}Change b/)
    await ui.unmount()
  })
}

test('the uncommitted changes are the first row of the commit list', async ($, on) => {
  engine(on, pending(scenario()))
  const { ui } = await openPane($, 'terminal')
  await ui.press({ key: 'commit-toggle' })
  const rows = await rowsOf(ui, 'commit')
  expect(rows.map(row => row.key)).toEqual(['commit:uncommitted', `commit:${sha('c')}`, `commit:${sha('b')}`, `commit:${sha('a')}`])
  expect(rows[0]?.text).toMatch(/✿ Uncommitted changes · 4 files/)
  await ui.press({ key: 'commit:uncommitted' })
  expect(await current(ui, 'commit')).toMatch(/Uncommitted changes/)
  await ui.unmount()
})

test("each file shows git's two letters, and the label above its diff says what is staged", async ($, on) => {
  engine(on, pending(scenario()))
  const { ui } = await openPane($, 'terminal')
  await ui.press({ key: 'newer' })
  const drawn = JSON.stringify(await ui.drawn())
  for (const tag of ['"M "', '" M"', '"MM"', '"??"']) expect(drawn).toContain(`"children":[${tag}`)

  expect(await labels(ui)).toEqual(['✿ Staged changes'])
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('@@ -1 +1 @@\n-old staged\n+new staged')

  await ui.press({ key: 'next-file' })
  expect(await labels(ui)).toEqual(['✿ Unstaged changes'])

  // Staged and then edited again: two parts, each under its own label.
  await ui.press({ key: 'next-file' })
  expect(await labels(ui)).toEqual(['✿ Staged changes', '✿ Unstaged changes'])
  expect((await ui.findAll({ type: 'Code' })).map((code: { props: { source?: string } }) => code.props.source)).toEqual(['@@ -1 +1 @@\n-v1\n+v2', '@@ -1 +1 @@\n-v2\n+v3'])

  await ui.press({ key: 'next-file' })
  expect(await labels(ui)).toEqual(['✿ Unstaged changes'])
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('@@ -0,0 +1,2 @@\n+# Draft\n+first line')
  await ui.unmount()
})

test('After shows each file as it is now, built from git alone; Before shows the last commit', async ($, on) => {
  const world = pending(scenario())
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  await ui.press({ key: 'newer' })
  await ui.press({ key: 'mode-after' })
  const shown = async () => (await ui.find({ type: 'Code' }))?.props.source ?? (await ui.find({ type: 'Text', text: /./ }))?.text

  // Staged only: what is on disk is the staged copy.
  expect(await shown()).toBe('staged content of src/staged.ts')
  expect(await labels(ui)).toEqual(['✿ Staged changes'])
  // Edited on disk: rebuilt from the whole-file diff.
  await ui.press({ key: 'next-file' })
  expect(await shown()).toBe('kept line\nafter edit')
  await ui.press({ key: 'next-file' })
  expect(await labels(ui)).toEqual(['✿ Staged and unstaged changes'])
  expect(await shown()).toBe('v3')
  // Untracked: the whole file.
  await ui.press({ key: 'next-file' })
  expect(await shown()).toBe('# Draft\nfirst line')

  await ui.press({ key: 'mode-before' })
  expect(await ui.find({ type: 'Text', text: /A new file: the last commit does not have it/ })).toBeDefined()
  await ui.press({ key: 'prev-file' })
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe(`content of src/both.ts at ${sha('c').slice(0, 7)}`)

  // Nothing here reads a file itself: every run is git's.
  expect(world.runs.every(run => /^\/repo(-side)?: [a-z-]+/.test(run))).toBe(true)
  await ui.unmount()
})

test('with a clean worktree Newer stays Newer, and there is no uncommitted row', async ($, on) => {
  engine(on, scenario())
  const { ui } = await openPane($, 'terminal')
  expect((await ui.find({ key: 'newer' }))?.text).toBe('Newer')
  await ui.press({ key: 'newer' })
  expect(await current(ui, 'commit')).toMatch(/ccccccc/)
  await ui.press({ key: 'commit-toggle' })
  expect((await rowsOf(ui, 'commit')).some(row => row.key === 'commit:uncommitted')).toBe(false)
  await ui.unmount()
})

test('when Claude commits everything, the pane moves on to that commit', async ($, on) => {
  const world = pending(scenario())
  engine(on, world)
  const clock = mock.clock(on)
  on('tool.call', () => ({ result: { ok: true } }) as never)
  const { ui } = await openPane($, 'terminal')
  await ui.press({ key: 'newer' })
  expect(await current(ui, 'commit')).toMatch(/Uncommitted changes/)

  // Some committed, some not: the pane stays on what is left.
  world.logs['/repo']!.unshift({ sha: sha('e'), parents: [sha('c')], subject: 'Part one', files: [{ status: 'M', path: 'src/staged.ts', added: 1, deleted: 1 }] })
  world.pending['/repo'] = world.pending['/repo']!.slice(1)
  await $.tool.call({ tool: 'Bash', input: { command: 'git commit -m "Part one"' }, tool_use_id: 'toolu_one' } as never)
  await clock.advance(1000)
  expect(await current(ui, 'commit')).toMatch(/✿ Uncommitted changes · 3 files/)

  // Everything committed: the pane follows the new commit.
  world.logs['/repo']!.unshift({ sha: sha('f'), parents: [sha('e')], subject: 'Part two', files: [{ status: 'M', path: 'src/both.ts', added: 1, deleted: 1 }] })
  world.pending['/repo'] = []
  await $.tool.call({ tool: 'Bash', input: { command: 'git commit -am "Part two"' }, tool_use_id: 'toolu_two' } as never)
  await clock.advance(1000)
  expect(await current(ui, 'commit')).toMatch(/fffffff {2}Part two/)
  expect(await ui.find({ type: 'Text', text: /Following the newest commit/ })).toBeDefined()
  await ui.unmount()
})

test('an edit that makes no commit reads only the uncommitted changes again', async ($, on) => {
  const world = pending(scenario())
  engine(on, world)
  const clock = mock.clock(on)
  on('tool.call', () => ({ result: { ok: true } }) as never)
  const { ui } = await openPane($, 'terminal')
  await ui.press({ key: 'newer' })
  const runsOf = (command: string) => world.runs.filter(run => run.includes(`: ${command}`)).length
  const logs = runsOf('log ')
  const statuses = runsOf('status ')

  world.pending['/repo']!.push({ xy: '??', path: 'src/brand-new.ts', lines: ['export {}'] })
  await $.tool.call({ tool: 'Write', input: { file_path: '/repo/src/brand-new.ts', content: 'export {}' }, tool_use_id: 'toolu_write' } as never)
  await clock.advance(1000)
  expect(runsOf('log ')).toBe(logs)
  expect(runsOf('status ')).toBe(statuses + 1)
  expect(await current(ui, 'commit')).toMatch(/✿ Uncommitted changes · 5 files/)
  await ui.unmount()
})

test('before the first commit, the uncommitted changes are walked instead of the welcome screen', async ($, on) => {
  const world = pending(scenario())
  world.logs['/repo'] = []
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect(await current(ui, 'commit')).toMatch(/✿ Uncommitted changes · 4 files/)
  expect((await ui.find({ key: 'older' }))?.props.dimColor).toBe(true)
  await ui.press({ key: 'mode-before' })
  expect(await ui.find({ type: 'Text', text: /No commits yet: there is no earlier version/ })).toBeDefined()
  await ui.unmount()
})
