import { expect, test } from 'claude-code/testing'

import { windowAround } from '../hooks/window'

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
