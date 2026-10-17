import { expect, test } from 'claude-code/testing'

import { scrollStart, windowAround } from '../hooks/window'

const list = (n: number) => Array.from({ length: n }, (_, i) => `item-${i}`)

test('a list that fits is drawn whole', async () => {
  const win = windowAround(list(10), 3, 10)
  expect(win.items.length).toBe(10)
  expect(win.before + win.after).toBe(0)
})

test('a long list is a window plus the two edge rows, around the selection', async () => {
  for (const at of [0, 1, 4, 50, 98, 99]) {
    const win = windowAround(list(100), at, 10)
    expect(win.items.length).toBe(8)
    expect(win.items).toContain(`item-${at}`)
    expect(win.start + win.items.length + win.after).toBe(100)
  }
  expect(windowAround(list(100), 0, 10).before).toBe(0)
  expect(windowAround(list(100), 99, 10).after).toBe(0)
})

test('a scrolled list holds until the selection changes', async () => {
  expect(scrollStart(5, 3, 8, undefined, 'a')).toBe(0)
  expect(scrollStart(40, 20, 8, undefined, 'x')).toBe(16)
  expect(scrollStart(40, 20, 8, { start: 30, anchor: 'x' }, 'x')).toBe(30)
  expect(scrollStart(40, 20, 8, { start: 99, anchor: 'x' }, 'x')).toBe(32)
  expect(scrollStart(40, 21, 8, { start: 30, anchor: 'x' }, 'y')).toBe(17)
  expect(scrollStart(40, 33, 8, { start: 30, anchor: 'x' }, 'y')).toBe(30)
  expect(scrollStart(40, 0, 8, { start: -5, anchor: 'a' }, 'a')).toBe(0)
})
