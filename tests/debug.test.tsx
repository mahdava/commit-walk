// The debug section.

import { expect, test } from 'claude-code/testing'

import { scenario, engine, openPane } from './support'

test('the debug section shows the pane, the selection and the last git commands', async ($, on) => {
  const world = scenario()
  engine(on, world)
  const { ui } = await openPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /^Debug$/ })).toBeUndefined()

  const answer = await $.command.run({ command: 'commit-walk', args: 'debug', origin: { kind: 'user' }, presentation: {} } as never)
  expect(answer.text).toBe('Commit walk debug section shown.')
  expect(await ui.find({ type: 'Text', text: /^Debug$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^pane 84×80 dock/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /commit ccccccc · file src\/b\.ts/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /3 commits · 2 files/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /0 +\d+ms {2}log -z --max-count=100/ })).toBeDefined()

  await ui.press({ key: 'debug' })
  expect(await ui.find({ type: 'Text', text: /^Debug$/ })).toBeUndefined()
  await ui.unmount()
})

test('the debug section names a failing git command and its error', async ($, on) => {
  const world = scenario()
  engine(on, world, '/nowhere')
  const { ui } = await openPane($, 'terminal', '/nowhere')
  await ui.press({ key: 'debug' })
  expect(await ui.find({ type: 'Text', text: /128 +\d+ms {2}rev-parse --show-toplevel {2}· fatal: not a git repository/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /welcome art: (large|medium|small)/ })).toBeDefined()
  await ui.unmount()
})
