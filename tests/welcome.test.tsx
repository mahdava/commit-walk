// The welcome screen: its art, sized to the pane, and when it shows.

import { expect, test } from 'claude-code/testing'

import { PANE, scenario, engine, current, pickFrom, openPane } from './support'

test('a worktree with no commits shows the welcome art and waits', async ($, on) => {
  const world = scenario()
  world.logs['/repo'] = []
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /No commits on main yet/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Commit Walk/ })).toBeDefined()
  expect(await ui.find({ key: 'worktree-toggle' })).toBeDefined()
  world.logs['/repo'] = scenario().logs['/repo']!
  await ui.press({ key: 'refresh' })
  expect(await current(ui, 'commit')).toMatch(/ccccccc/)
  await ui.unmount()
})

test('the welcome art is sized to the pane: large, medium, or the small sunflower in its palette', async ($, on) => {
  const world = scenario()
  engine(on, world, '/nowhere')
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'commit-walk', args: '', origin: { kind: 'user' }, presentation: {} } as never)
  const mountAt = (bodyColumns: number, bodyRows: number) =>
    $.ui.mount({ plugin: 'commit-walk', surface: 'terminal', ...PANE, props: { ...PANE.props, bodyColumns, scroll: { offset: 0, bodyRows } } })

  // The welcome block is the first child of the pane: a Box of art rows, or one Text for the mark.
  const welcomeOf = async (ui: { drawn: () => Promise<unknown> }) => {
    const tree = (await ui.drawn()) as { children: { type: string; children?: unknown[] }[] }
    return tree.children[0]!
  }

  const large = await mountAt(84, 60)
  const big = await welcomeOf(large)
  expect(big.type).toBe('Box')
  expect(big.children?.length).toBe(36 + 3)
  await large.unmount()

  const medium = await mountAt(84, 40)
  expect((await welcomeOf(medium)).children?.length).toBe(22 + 3)
  await medium.unmount()

  const small = await mountAt(84, 25)
  expect((await welcomeOf(small)).children?.length).toBe(11 + 3)
  // Lucia's small sunflower keeps her map builder palette, colour by character.
  const drawn = JSON.stringify(await small.drawn())
  for (const color of ['#c49a03', '#421e05', '#2d6d2d', '#f05151', '#0f5106', '#ffffff']) expect(drawn).toContain(`"color":"${color}"`)
  expect(drawn).not.toContain(';')
  expect(drawn).toContain('━━━━━━')
  for (const color of ['#3B82F6', '#2EA043', '#F5B800', '#EF4444']) expect(drawn).toContain(`"color":"${color}"`)
  await small.unmount()

  // The pane is never narrower than 24 columns, so the 18-column small sunflower always fits.
  const narrow = await mountAt(18, 60)
  expect((await welcomeOf(narrow)).children?.length).toBe(11 + 3)
  await narrow.unmount()
})

test('main shows the welcome screen; Show all commits reveals its history', async ($, on) => {
  const world = scenario()
  world.originHead = 'origin/main'
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /You're on main\. Work happens on branches/ })).toBeDefined()
  expect(await ui.find({ key: 'commit-toggle' })).toBeUndefined()
  expect((await ui.find({ key: 'range-notInDefault' }))?.props.variant).toBe('primary')

  await ui.press({ key: 'show-all' })
  expect(await current(ui, 'commit')).toMatch(/ccccccc {2}Change b/)
  expect((await ui.find({ key: 'range-all' }))?.props.variant).toBe('primary')

  await ui.press({ key: 'range-notInDefault' })
  expect(await ui.find({ type: 'Text', text: /You're on main/ })).toBeDefined()
  await ui.unmount()
})

test('a branch level with main waits on the welcome screen, then follows its first commit', async ($, on) => {
  const world = scenario()
  world.originHead = 'origin/main'
  world.ahead = { '/repo-side': { 'origin/main': 0 } }
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  await pickFrom(ui, 'worktree', '/repo-side')
  expect(await ui.find({ type: 'Text', text: /No commits on side beyond origin\/main yet\./ })).toBeDefined()
  expect(await ui.find({ key: 'show-all' })).toBeDefined()

  world.ahead['/repo-side']!['origin/main'] = 1
  await ui.press({ key: 'refresh' })
  expect(await current(ui, 'commit')).toMatch(/ddddddd {2}Side work/)
  await ui.unmount()
})
