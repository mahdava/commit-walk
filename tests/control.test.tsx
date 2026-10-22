// Text from git that Claude Code would refuse to draw: control characters in
// subjects, paths and files are shown as symbols, and a drawing that throws
// says so instead of leaving the pane blank.

import { expect, test } from 'claude-code/testing'

import { hasHidden, printable, printableLine } from '../hooks/printable'
import { sha, scenario, engine, selectedFile, current, openPane } from './support'

const ESC = '\x1b'

test('control characters become their symbols; tabs and line breaks stay in blocks only', () => {
  expect(printable(`a${ESC}[31mb\fc\x7fd\x9be`)).toBe('a␛[31mb␌c␡d�e')
  expect(printable('one\ttwo\r\nthree')).toBe('one\ttwo\r\nthree')
  expect(printableLine('one\ttwo\r\nthree')).toBe('one two  three')
  expect(hasHidden('plain\ttext\r\n')).toBe(false)
  expect(hasHidden(`colour ${ESC}[0m`)).toBe(true)
})

test('characters that draw as nothing or reorder text become markers; joiners stay', () => {
  // The classic Trojan Source line: an override makes the comment read as its end.
  expect(printable('if (isAdmin) { ‮} ⁦// skip⁩')).toBe('if (isAdmin) { ⟨RLO⟩} ⟨LRI⟩// skip⟨PDI⟩')
  expect(printable('﻿const a​ = 1­')).toBe('⟨BOM⟩const a⟨ZWSP⟩ = 1⟨SHY⟩')
  expect(printableLine('one two')).toBe('one⟨LS⟩two')
  // A zero-width joiner holds an emoji together, and a non-joiner shapes Persian.
  const kept = '👩‍💻 می‌خواهم'
  expect(printable(kept)).toBe(kept)
  expect(hasHidden(kept)).toBe(false)
  expect(hasHidden('a‮b')).toBe(true)
})

/** A commit whose subject, file path and diff hold a colour code and a form feed. */
function colourful() {
  const world = scenario()
  world.logs['/repo']!.unshift({
    sha: sha('e'),
    parents: [sha('c')],
    subject: `Fix ${ESC}[31mred${ESC}[0m output\f`,
    files: [{ status: 'M', path: `src/odd${ESC}name.ts`, added: 1, deleted: 1 }, { status: 'M', path: 'src/b.ts', added: 1, deleted: 1 }],
  })
  return world
}

for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
  test(`a commit with control characters is drawn with symbols (${surface})`, async ($, on) => {
    engine(on, colourful())
    const { ui } = await openPane($, surface)

    expect(await current(ui, 'commit')).toMatch(/eeeeeee {2}Fix ␛\[31mred␛\[0m output␌/)
    // The row keeps the real path, so picking it still asks git for that file.
    expect(await selectedFile(ui)).toBe(`src/odd${ESC}name.ts`)
    const diff = await ui.find({ type: 'Code' })
    expect(diff?.props.source).toContain('+new line in Fix ␛[31mred␛[0m output␌')
    expect(await ui.find({ type: 'Text', text: /holds hidden characters, shown as symbols/ })).toBeDefined()

    await ui.press({ key: 'mode-after' })
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe(`content of src/odd␛name.ts at ${sha('e').slice(0, 7)}`)
    await ui.unmount()
  })
}

test('a subject and a file with a right-to-left override show its marker', async ($, on) => {
  const world = scenario()
  world.logs['/repo']![0]!.subject = 'Check access ‮nimda‬'
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect(await current(ui, 'commit')).toMatch(/ccccccc {2}Check access ⟨RLO⟩nimda⟨PDF⟩/)
  expect((await ui.find({ type: 'Code' }))?.props.source).toContain('+new line in Check access ⟨RLO⟩nimda⟨PDF⟩')
  expect(await ui.find({ type: 'Text', text: /holds hidden characters, shown as symbols/ })).toBeDefined()
  await ui.unmount()
})

test('a drawing that throws says what failed instead of leaving the pane blank', async ($, on) => {
  engine(on, scenario())
  let isBroken = false
  // A snapshot the pane cannot draw from: none at all.
  on('state.get', async (_$, e, next) => {
    const read = await next(e)
    return isBroken && e.key === 'snapshot' ? ({ value: null } as never) : read
  })
  const { ui } = await openPane($, 'terminal')
  expect(await current(ui, 'commit')).toMatch(/Change b/)

  isBroken = true
  await ui.press({ key: 'debug' })
  expect(await ui.find({ type: 'Text', text: /Commit walk could not draw this view/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\/commit-walk refresh to try again/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Detail: null is not an object/ })).toBeDefined()
  await ui.unmount()
})

test("a button whose work fails shows why in the pane's error line", async ($, on) => {
  engine(on, scenario())
  // The next read of the selection comes back malformed, so stepping fails part way.
  let failNextRead = false
  on('state.get', async (_$, e, next) => {
    if (failNextRead && e.key === 'selection') {
      failNextRead = false
      return { value: null } as never
    }
    return next(e)
  })
  const { ui } = await openPane($, 'terminal')

  failNextRead = true
  await ui.press({ key: 'older' })
  expect(await ui.find({ type: 'Text', text: /null is not an object/ })).toBeDefined()
  expect(await current(ui, 'commit')).toMatch(/ccccccc/)
  await ui.unmount()
})

test('a file without control characters gets no note', async ($, on) => {
  const world = scenario()
  world.logs['/repo']![0]!.subject = 'Tabs\tand\rbreaks'
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect(await current(ui, 'commit')).toMatch(/ccccccc {2}Tabs and breaks/)
  expect(await ui.find({ type: 'Text', text: /holds hidden characters/ })).toBeUndefined()
  await ui.unmount()
})
