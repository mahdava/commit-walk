import { expect, test } from 'claude-code/testing'

import { AFTER_VALUE, BEFORE_VALUE, MAX_SELECT_OPTIONS, pickedIndex, windowAround } from '../hooks/window'

const list = (n: number) => Array.from({ length: n }, (_, i) => `item-${i}`)
const id = (s: string) => s

test('a list that fits is drawn whole', async () => {
  const win = windowAround(list(64), 10)
  expect(win.items.length).toBe(64)
  expect(win.before + win.after).toBe(0)
})

test('a long list is a window of 62 plus the two edge entries', async () => {
  for (const at of [0, 1, 31, 50, 199, 399]) {
    const win = windowAround(list(400), at)
    const options = win.items.length + (win.before > 0 ? 1 : 0) + (win.after > 0 ? 1 : 0)
    expect(options).toBeLessThanOrEqual(MAX_SELECT_OPTIONS)
    expect(win.items).toContain(`item-${at}`)
    expect(win.start + win.items.length + win.after).toBe(400)
  }
})

test('the edge entries land just past the window', async () => {
  const win = windowAround(list(400), 200)
  expect(pickedIndex(win, BEFORE_VALUE, id)).toBe(win.start - 1)
  expect(pickedIndex(win, AFTER_VALUE, id)).toBe(win.start + win.items.length)
  expect(pickedIndex(win, 'item-200', id)).toBe(200)
  expect(pickedIndex(win, 'item-0', id)).toBe(-1)
  const first = windowAround(list(400), 0)
  expect(first.before).toBe(0)
  expect(pickedIndex(first, BEFORE_VALUE, id)).toBe(-1)
})
