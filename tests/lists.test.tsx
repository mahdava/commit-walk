// The lists: eight rows at a time with a scroll column, row presses, and hover cards.

import { expect, test } from 'claude-code/testing'

import { sha, scenario, engine, rowsOf, selectedFile, current, openPane } from './support'

test('long lists show eight rows with a scroll column, and the selection stays put while scrolling', async ($, on) => {
  const world = scenario()
  const hex = (n: number) => n.toString(16).padStart(40, '0')
  const files = Array.from({ length: 400 }, (_, i) => ({ status: 'M', path: `src/file-${i}.ts`, added: 1, deleted: 1 }))
  world.logs['/repo'] = Array.from({ length: 100 }, (_, i) => ({
    sha: hex(1000 - i),
    parents: i === 99 ? [] : [hex(999 - i)],
    subject: `Commit ${100 - i}`,
    files,
  }))
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect((await rowsOf(ui, 'file')).length).toBe(8)
  expect(await ui.find({ type: 'Text', text: /1–8 of 400 files · ▲ ▼ scroll/ })).toBeDefined()

  await ui.press({ key: 'file-down' })
  expect(await ui.find({ type: 'Text', text: /8–15 of 400 files/ })).toBeDefined()
  expect(await selectedFile(ui)).toBeUndefined()
  expect(await rowsOf(ui, 'file').then(rows => rows[0]?.key)).toBe('file:src/file-7.ts')
  await ui.press({ key: 'file:src/file-10.ts' })
  expect(await selectedFile(ui)).toBe('src/file-10.ts')
  expect(await ui.find({ type: 'Text', text: /8–15 of 400 files/ })).toBeDefined()
  await ui.press({ key: 'file-up' })
  await ui.press({ key: 'file-up' })
  expect(await ui.find({ type: 'Text', text: /1–8 of 400 files/ })).toBeDefined()

  // A selection moved out of view brings the list back around it.
  for (let i = 0; i < 8; i++) await ui.press({ key: 'next-file' })
  expect(await selectedFile(ui)).toBe('src/file-18.ts')
  expect(await ui.find({ type: 'Text', text: /15–22 of 400 files/ })).toBeDefined()

  await ui.press({ key: 'commit-toggle' })
  expect((await rowsOf(ui, 'commit')).length).toBe(8)
  expect(await ui.find({ type: 'Text', text: /1–8 of 100 commits/ })).toBeDefined()
  await ui.press({ key: 'commit-down' })
  await ui.press({ key: 'commit:' + hex(1000 - 9) })
  expect(await current(ui, 'commit')).toMatch(/Commit 91/)
  expect(await rowsOf(ui, 'commit')).toEqual([])
  await ui.unmount()
})

test('the file list: a row press selects that file, short lists have no scroll column', async ($, on) => {
  const world = scenario()
  const files = Array.from({ length: 20 }, (_, i) => ({ status: 'M', path: `src/f${String(i).padStart(2, '0')}.ts`, added: 1, deleted: 0 }))
  world.logs['/repo']![0]!.files = files
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect(await selectedFile(ui)).toBe('src/f00.ts')
  await ui.press({ key: 'file:src/f05.ts' })
  expect(await selectedFile(ui)).toBe('src/f05.ts')
  expect(await ui.find({ key: 'file-down' })).toBeDefined()

  world.logs['/repo']![0]!.files = files.slice(0, 5)
  await ui.press({ key: 'refresh' })
  expect((await rowsOf(ui, 'file')).length).toBe(5)
  expect(await ui.find({ key: 'file-down' })).toBeUndefined()
  await ui.unmount()
})

test('a clipped row carries a hover card with its whole line; the selected file shows its full name', async ($, on) => {
  const world = scenario()
  const long = 'src/components/a/very/deeply/nested/folder/structure/that/keeps/going/Component.tsx'
  world.logs['/repo']![0]!.files = [
    { status: 'R', oldPath: 'src/Old.tsx', path: long, added: 3, deleted: 1 },
    { status: 'M', path: 'src/short.ts', added: 1, deleted: 0 },
  ]
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  const tree = JSON.stringify(await ui.drawn())
  // The card: hidden, revealed on hover, absolute, holding the whole line in inverse video.
  const card = /"position":"absolute","top":1,"left":(\d+),"display":"none","flexDirection":"column"\},"hover":\{"display":"flex"\}/
  expect(card.test(tree)).toBe(true)
  expect(tree.match(new RegExp(card.source, 'g'))?.length).toBe(1)
  const cardText = [...tree.matchAll(/"inverse":true\},"children":\[" ([^"]*) "\]/g)].map(m => m[1]!.trimEnd()).join('')
  expect(cardText).toBe(`src/Old.tsx → ${long}  +3 −1`)
  // The selected (first) file's whole name under the list.
  expect(await ui.find({ type: 'Text', text: new RegExp(`^▶ src\\/Old\\.tsx → ${long.replace(/\//g, '\\/')}$`) })).toBeDefined()

  await ui.press({ key: 'file:src/short.ts' })
  expect(await ui.find({ type: 'Text', text: /^▶ src\/short\.ts$/ })).toBeUndefined()
  await ui.unmount()
})
