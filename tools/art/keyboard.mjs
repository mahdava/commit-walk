// keyboard.mjs > assets/keyboard.svg: the pane's keys on a small keyboard,
// coloured by what they do, each with a label tab pointing up at it.
// The keys' groups, labels and colours are in keys.mjs, shared with the demo.
// The outlined logo sits in the free corner left of the arrows, inlined so
// it draws wherever the picture is shown as an image.
import { readFileSync } from 'node:fs'

import { GROUPS, KEYS } from './keys.mjs'

const U = 64 // one key unit, in px
const GAP = 6 // between keys in a row
const LANE = 40 // under each row, for the label tabs
const PAD = 20

const C = {
  body: '#2b3542', // blue-grey
  bodyEdge: '#1a2029',
  key: '#f8f3e6',
  keyEdge: '#d8cfb8',
  keyText: '#9b8f78',
  dark: '#3e1800',
}

// [cap, width in units]; what a key does comes from KEYS.
const ROWS = [
  [['Esc', 1.25], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['⌫', 2]],
  [['Tab', 1.5], ['q', 1], ['w', 1], ['e', 1], ['r', 1], ['t', 1], ['y', 1], ['u', 1], ['i', 1], ['o', 1], ['p', 1], ['', 1.75]],
  [['', 1.75], ['a', 1], ['s', 1], ['d', 1], ['f', 1], ['g', 1], ['h', 1], ['j', 1], ['k', 1], ['l', 1], ['Enter', 2.5]],
  [['⇧', 2.25], ['z', 1], ['x', 1], ['c', 1], ['v', 1], ['b', 1], ['n', 1], ['m', 1], ['', 1], ['', 1], ['↑', 1], ['', 1]],
  // Only the arrows: tucked under ↑, with no label lane between them.
  [['←', 1], ['↓', 1], ['→', 1]],
]
const ARROWS = ROWS.length - 1
const UP_AT = 2.25 + 9 // ↑'s left edge, in units: ⇧ and nine keys before it
const PITCH = U + LANE

let out = ''
let width = 0
ROWS.forEach((row, r) => {
  let x = r === ARROWS ? PAD + (UP_AT - 1) * U : PAD
  const y = r === ARROWS ? PAD + (r - 1) * PITCH + U : PAD + r * PITCH
  for (const [cap, w] of row) {
    const { group, label } = KEYS[cap] ?? {}
    const kw = w * U - GAP
    const kh = U - GAP
    const fill = group ? GROUPS[group].color : C.key
    out += `<rect x="${x}" y="${y}" width="${kw}" height="${kh}" rx="10" fill="${group ? 'rgba(0,0,0,.3)' : C.keyEdge}"/>`
    out += `<rect x="${x}" y="${y}" width="${kw}" height="${kh - 5}" rx="10" fill="${fill}"/>`
    if (cap) {
      const one = [...cap].length === 1
      out += `<text x="${x + kw / 2}" y="${y + (kh - 5) / 2 + (one ? 7 : 5)}" text-anchor="middle" font-size="${one ? 20 : 14}" font-weight="${group ? 800 : 500}" fill="${group ? GROUPS[group].ink : C.keyText}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">${cap}</text>`
    }
    if (label) {
      // A tab under the key, notched towards it.
      // Two-line labels sit under single keys whose neighbours are labelled too.
      const lines = label.split('\n')
      const tw = Math.max(kw - 4, Math.max(...lines.map(l => l.length)) * 7.2 + 10)
      const th = lines.length === 1 ? 19 : 32
      const tx = x + kw / 2 - tw / 2
      const ty = y + kh + 8
      const cx = x + kw / 2
      out += `<path d="M${cx - 6} ${ty} L${cx} ${ty - 6} L${cx + 6} ${ty} Z" fill="${GROUPS[group].color}"/>`
      out += `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="9.5" fill="${GROUPS[group].color}"/>`
      lines.forEach((l, i) => {
        out += `<text x="${cx}" y="${ty + 14 + i * 13}" text-anchor="middle" font-size="12" font-weight="700" fill="${GROUPS[group].ink}">${l}</text>`
      })
    }
    x += w * U
  }
  width = Math.max(width, x)
})
const W = width + PAD - GAP
const H = PAD * 2 + (ROWS.length - 1) * PITCH + U - GAP - LANE + 30

const legend = ROWS.flat().filter(([cap]) => KEYS[cap]?.label).map(([cap]) => `${cap === '↓' ? 'arrows' : cap}: ${KEYS[cap].label.replace('\n', ' ')}`).join('; ')
process.stdout.write(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">
<title id="t">Commit Walk keys</title>
<desc id="d">${legend}</desc>
<rect width="${W}" height="${H}" rx="24" fill="${C.bodyEdge}"/>
<rect x="3" y="3" width="${W - 6}" height="${H - 9}" rx="22" fill="${C.body}"/>
${out}
${logo()}
</svg>
`)

/** The outlined logo, bottom left, left of the arrows: drawn over the keys, so it may overlap Shift. */
function logo() {
  const source = readFileSync(new URL('../../assets/commit-walk-logo-outlined.svg', import.meta.url), 'utf8')
  const [vw, vh] = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number)
  const height = 112
  const width = (height * vw) / vh
  const x = PAD + 4
  const y = H - PAD - height + 2
  return source
    .replace(/^<\?xml[^>]*>/, '')
    .replace(/<!DOCTYPE[^>]*>/, '')
    .replace(/ id="[^"]*"/g, '')
    .replace(/<svg width="100%" height="100%"/, `<svg x="${x}" y="${y}" width="${width.toFixed(1)}" height="${height}" aria-hidden="true"`)
}
