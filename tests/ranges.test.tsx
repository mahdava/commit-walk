// The commit ranges: what a worktree offers, the default branch, and h.

import { expect, test } from 'claude-code/testing'

import { sha, scenario, engine, rowsOf, current, pickFrom, openPane } from './support'

test('the Commits row offers what the worktree has: not in the default branch, since its base', async ($, on) => {
  const world = scenario()
  const hex = (n: number) => n.toString(16).padStart(40, '0')
  world.logs['/repo-side'] = Array.from({ length: 5 }, (_, i) => ({
    sha: hex(500 - i), parents: [hex(499 - i)], subject: `Side ${5 - i}`,
    files: [{ status: 'M', path: 'side.ts', added: 1, deleted: 0 }],
  }))
  world.originHead = 'origin/main'
  world.ahead = { '/repo-side': { 'origin/main': 3, 'feat-base': 2 } }
  world.distances = { '/repo-side': 'main\t4 3\nside\t0 0\nfeat-base\t1 2\nchild\t2 0\nfar\t9 4\n' }
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  // On main itself "not in origin/main" is empty: the welcome screen, with the row to switch.
  expect(await ui.find({ type: 'Text', text: /You're on main\. Work happens on branches/ })).toBeDefined()
  expect((await ui.find({ key: 'range-notInDefault' }))?.text).toBe('not in origin/main · 0')

  await pickFrom(ui, 'worktree', '/repo-side')
  // "not in the default branch" is the default where it is offered.
  expect((await ui.find({ key: 'range-notInDefault' }))?.props.variant).toBe('primary')
  expect((await ui.find({ key: 'range-all' }))?.props.variant).toBeUndefined()
  expect((await ui.find({ key: 'range-notInDefault' }))?.text).toBe('not in origin/main · 3')
  expect((await ui.find({ key: 'range-base' }))?.text).toBe('since feat-base · 2')

  await ui.press({ key: 'range-base' })
  expect((await ui.find({ key: 'range-base' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'commit-toggle' })
  expect((await rowsOf(ui, 'commit')).map(row => row.text?.trim().slice(9))).toEqual(['Side 5', 'Side 4'])
  await ui.press({ key: 'commit-toggle' })

  await ui.press({ key: 'range-notInDefault' })
  await ui.press({ key: 'commit-toggle' })
  expect((await rowsOf(ui, 'commit')).length).toBe(3)
  await ui.unmount()
})

test('h cycles the ranges, and a range switch keeps a commit the new range has', async ($, on) => {
  const world = scenario()
  const hex = (n: number) => n.toString(16).padStart(40, '0')
  world.logs['/repo-side'] = Array.from({ length: 5 }, (_, i) => ({
    sha: hex(500 - i), parents: [hex(499 - i)], subject: `Side ${5 - i}`,
    files: [{ status: 'M', path: 'side.ts', added: 1, deleted: 0 }],
  }))
  world.originHead = 'origin/main'
  world.ahead = { '/repo-side': { 'origin/main': 3, 'feat-base': 2 } }
  world.distances = { '/repo-side': 'main\t4 3\nside\t0 0\nfeat-base\t1 2\nchild\t2 0\nfar\t9 4\n' }
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  const hotkeyOn = async () => {
    for (const mode of ['all', 'notInDefault', 'base']) if ((await ui.find({ key: `range-${mode}` }))?.props.hotkey === 'h') return mode
    return null
  }
  const chosen = async () => {
    for (const mode of ['all', 'notInDefault', 'base']) if ((await ui.find({ key: `range-${mode}` }))?.props.variant === 'primary') return mode
    return null
  }
  // On main the welcome screen's h is the step to all commits.
  expect(await hotkeyOn()).toBe('all')

  await pickFrom(ui, 'worktree', '/repo-side')
  expect(await chosen()).toBe('notInDefault')
  expect(await hotkeyOn()).toBe('base')
  // Pinned to the third commit, which "not in" and "all" have and "since feat-base" does not.
  await ui.press({ key: 'older' })
  await ui.press({ key: 'older' })
  expect(await current(ui, 'commit')).toMatch(/Side 3/)

  await ui.press({ key: 'range-all' })
  expect(await chosen()).toBe('all')
  expect(await hotkeyOn()).toBe('notInDefault')
  expect(await current(ui, 'commit')).toMatch(/Side 3/)

  await ui.press({ key: 'range-notInDefault' })
  expect(await current(ui, 'commit')).toMatch(/Side 3/)
  // Not in the new range: the newest of it.
  await ui.press({ key: 'range-base' })
  expect(await current(ui, 'commit')).toMatch(/Side 5/)
  expect(await hotkeyOn()).toBe('all')
  await ui.unmount()
})

test('a repository whose default branch is master, with no origin/HEAD', async ($, on) => {
  const world = scenario()
  world.originHead = null
  world.refs = ['refs/heads/master']
  world.branches['/repo-side'] = 'side'
  world.ahead = { '/repo-side': { master: 1 } }
  world.distances = { '/repo-side': 'master\t2 1\nside\t0 0\n' }
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  await pickFrom(ui, 'worktree', '/repo-side')
  expect((await ui.find({ key: 'range-notInDefault' }))?.text).toBe('not in master · 1')
  // master is both the default and the nearest branch: no separate base option.
  expect(await ui.find({ key: 'range-base' })).toBeUndefined()
  await ui.unmount()
})

test('the range preference: not in default by default, all where not offered, a pick follows across worktrees', async ($, on) => {
  const world = scenario()
  const hex = (n: number) => n.toString(16).padStart(40, '0')
  world.logs['/repo-side'] = Array.from({ length: 5 }, (_, i) => ({
    sha: hex(500 - i), parents: [hex(499 - i)], subject: `Side ${5 - i}`,
    files: [{ status: 'M', path: 'side.ts', added: 1, deleted: 0 }],
  }))
  world.originHead = 'origin/main'
  world.ahead = { '/repo-side': { 'origin/main': 2 } }
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  // On main "not in" is empty: the welcome screen instead of main's history.
  expect(await ui.find({ type: 'Text', text: /You're on main/ })).toBeDefined()

  // The feature worktree opens on "not in".
  await pickFrom(ui, 'worktree', '/repo-side')
  expect((await ui.find({ key: 'range-notInDefault' }))?.props.variant).toBe('primary')
  // Counted from the oldest: the newest is 2 of 2, the one before it 1 of 2.
  expect(await ui.find({ type: 'Text', text: /2 of 2$/ })).toBeDefined()
  await ui.press({ key: 'older' })
  expect(await ui.find({ type: 'Text', text: /1 of 2$/ })).toBeDefined()
  await ui.press({ key: 'newer' })

  // A pick becomes the preference and survives a trip through main, which now shows its history.
  await ui.press({ key: 'range-all' })
  expect(await ui.find({ type: 'Text', text: /5 of 5$/ })).toBeDefined()
  await pickFrom(ui, 'worktree', '/repo')
  expect(await ui.find({ type: 'Text', text: /3 of 3$/ })).toBeDefined()
  await pickFrom(ui, 'worktree', '/repo-side')
  expect((await ui.find({ key: 'range-all' }))?.props.variant).toBe('primary')
  expect(await ui.find({ type: 'Text', text: /5 of 5$/ })).toBeDefined()
  await ui.unmount()
})
