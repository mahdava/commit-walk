// keys.mjs: the pane's keys, what each does and its colour, shared by the
// keyboard illustration (keyboard.mjs) and the demo's keycaps
// (../screenshots/render.mjs), so the two always say the same thing.
// Colours come from the logo: petal yellow, leaf green, the commit line's blue
// and red, a petal's orange edge.

export const DARK = '#3e1800' // the face's brown, for text on light keys

export const GROUPS = {
  commit: { color: '#fecd22', ink: DARK }, // petal: commits and their range
  file: { color: '#2f9b4f', ink: '#fff' }, // leaf: files
  view: { color: '#4c8bf5', ink: '#fff' }, // commit line blue: how a file is shown
  act: { color: '#f08a2c', ink: DARK }, // a petal's orange edge: actions, not errors
  nav: { color: '#e8553e', ink: '#fff' }, // the commit line's red: getting around the pane
}

// Key cap → its group and label. A label's \n is where the keyboard breaks it.
export const KEYS = {
  o: { group: 'commit', label: 'older\ncommit' },
  n: { group: 'commit', label: 'newer\ncommit' },
  h: { group: 'commit', label: 'commit\nrange' },
  f: { group: 'commit', label: 'branch\nstart' },
  j: { group: 'file', label: 'next\nfile' },
  k: { group: 'file', label: 'prev\nfile' },
  d: { group: 'view', label: 'file\ndiff' },
  a: { group: 'view', label: 'file\nafter' },
  b: { group: 'view', label: 'file\nbefore' },
  r: { group: 'act', label: 'refresh' },
  x: { group: 'act', label: 'debug' },
  Esc: { group: 'nav', label: 'close' },
  Tab: { group: 'nav', label: 'next control' },
  Enter: { group: 'nav', label: 'press' },
  '↑': { group: 'nav' },
  '←': { group: 'nav' },
  '↓': { group: 'nav', label: 'scroll' },
  '→': { group: 'nav' },
}
