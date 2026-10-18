// render.mjs <in.ansi> <out.png> [<in.ansi> <out.png> …]: tmux `capture-pane -eN` dumps drawn as terminal windows.
// Outside the rounded corners is transparent, or BACKDROP (a CSS colour) for video frames.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { GROUPS, KEYS } from '../art/keys.mjs'
// Playwright is not a dependency of the mod: PLAYWRIGHT_FROM names any folder whose node_modules holds it.
const require = createRequire(join(process.env.PLAYWRIGHT_FROM ?? process.cwd(), 'package.json'))
const { chromium } = require('playwright')

const pairs = process.argv.slice(2)
const title = 'claude — trail-notes'
const PALETTE = ['#1d1f21', '#cc6666', '#8fbf6a', '#e6c06a', '#6fa3d6', '#b58fd6', '#6fc6c0', '#c5c8c6',
  '#666a70', '#e57c7c', '#a8d98a', '#f0d48a', '#8ab8e6', '#c9a8e6', '#8ad9d2', '#ffffff']
const FG = '#d8dadc', BG = '#16181b'
const xterm = n => {
  if (n < 16) return PALETTE[n]
  if (n >= 232) { const v = 8 + (n - 232) * 10; return `rgb(${v},${v},${v})` }
  n -= 16; const s = [0, 95, 135, 175, 215, 255]
  return `rgb(${s[Math.floor(n / 36)]},${s[Math.floor(n / 6) % 6]},${s[n % 6]})`
}
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function line(text) {
  let st = {}, html = '', buf = ''
  const flush = () => {
    if (!buf) return
    let fg = st.fg, bg = st.bg
    if (st.reverse) [fg, bg] = [bg ?? BG, fg ?? FG]
    const css = []
    if (fg) css.push(`color:${fg}`)
    if (bg) css.push(`background:${bg}`)
    if (st.bold) css.push('font-weight:700')
    if (st.dim) css.push('opacity:.6')
    if (st.italic) css.push('font-style:italic')
    if (st.underline) css.push('text-decoration:underline')
    html += css.length ? `<span style="${css.join(';')}">${esc(buf)}</span>` : esc(buf)
    buf = ''
  }
  const re = /\x1b\[([0-9;:]*)m/g
  let at = 0, m
  while ((m = re.exec(text))) {
    buf += text.slice(at, m.index); at = re.lastIndex; flush()
    const p = m[1] === '' ? [0] : m[1].split(/[;:]/).map(Number)
    for (let i = 0; i < p.length; i++) {
      const c = p[i]
      if (c === 0) st = {}
      else if (c === 1) st.bold = true
      else if (c === 2) st.dim = true
      else if (c === 3) st.italic = true
      else if (c === 4) st.underline = true
      else if (c === 7) st.reverse = true
      else if (c === 22) st.bold = st.dim = false
      else if (c === 23) st.italic = false
      else if (c === 24) st.underline = false
      else if (c === 27) st.reverse = false
      else if (c >= 30 && c <= 37) st.fg = PALETTE[c - 30]
      else if (c >= 90 && c <= 97) st.fg = PALETTE[c - 82]
      else if (c >= 40 && c <= 47) st.bg = PALETTE[c - 40]
      else if (c >= 100 && c <= 107) st.bg = PALETTE[c - 92]
      else if (c === 39) delete st.fg
      else if (c === 49) delete st.bg
      else if (c === 38 || c === 48) {
        const key = c === 38 ? 'fg' : 'bg'
        if (p[i + 1] === 5) { st[key] = xterm(p[i + 2]); i += 2 }
        else if (p[i + 1] === 2) { st[key] = `rgb(${p[i + 2]},${p[i + 3]},${p[i + 4]})`; i += 4 }
      }
    }
  }
  buf += text.slice(at); flush()
  return html || ' '
}

const pageFor = input => {
const text = readFileSync(input, 'utf8').replace(/\n$/, '').split('\n')
// Every frame is the terminal's full width (COLS), so a video's frames share one size.
const cols = Number(process.env.COLS) || Math.max(...text.map(t => [...t.replace(/\x1b\[[0-9;:]*m/g, '')].length))
const rows = text.map(line)
// A frame may carry what is being done in it, in <frame>.json next to its capture:
// { pointer: [col, row], ring: true } for a click (1-based cells), { key, label } for a key.
const side = input.replace(/\.ansi$/, '.json')
const act = existsSync(side) ? JSON.parse(readFileSync(side, 'utf8')) : {}
let overlay = ''
if (act.pointer) {
  const [col, row] = act.pointer
  const at = `left:calc(12px + ${col - 0.5}ch);top:${40 + (row - 1) * 15 + 7.5}px`
  if (act.ring) overlay += `<div class="ring" style="${at}"></div>`
  overlay += `<svg class="ptr" style="${at}" width="26" height="32" viewBox="-2 -2 22 30"><path d="M0 0 L0 22 L6 16.5 L10 25.5 L14 23.5 L10 15 L17 15 Z" fill="#fecd22" stroke="#3e1800" stroke-width="1.8" stroke-linejoin="round"/></svg>`
}
if (act.key) {
  // The keycap in the key's colour and words from the keyboard illustration; a frame may say otherwise.
  const known = KEYS[act.key] ?? {}
  const { color, ink } = GROUPS[known.group ?? 'commit']
  const label = act.label ?? known.label?.replace('\n', ' ')
  overlay += `<div class="keyhint"><span class="cap" style="background:${color};color:${ink}">${esc(act.key)}</span>${label ? `<span class="what" style="background:${color};color:${ink}">${esc(label)}</span>` : ''}</div>`
}
return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Sym;src:url(${process.env.SYMBOL_FONT ? 'file://' + process.env.SYMBOL_FONT : 'seguisym.ttf'})}
html,body{background:${process.env.BACKDROP ?? 'transparent'}}
body{margin:0;display:inline-block}
.win{border-radius:10px;overflow:hidden;background:${BG}}
.bar{height:30px;background:#26292d;display:flex;align-items:center;padding:0 12px;gap:7px;position:relative}
.dot{width:12px;height:12px;border-radius:50%}
.t{position:absolute;left:0;right:0;text-align:center;color:#9a9ea3;font:12px system-ui,sans-serif}
pre{margin:0;padding:10px 12px 12px;width:${cols}ch;overflow:hidden;color:${FG};font:13px/15px "DejaVu Sans Mono",Sym,monospace;white-space:pre}
pre div{height:15px}
.win{position:relative}
.fx{position:absolute;inset:0;pointer-events:none;font:13px/15px "DejaVu Sans Mono",Sym,monospace}
.ptr{position:absolute;margin:-2px 0 0 -2px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}
.ring{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #fecd22;background:rgba(254,205,34,.22);box-sizing:border-box}
.keyhint{position:absolute;right:26px;bottom:78px;display:flex;align-items:center;gap:10px;font:600 15px system-ui,sans-serif}
.cap{min-width:38px;height:38px;padding:0 10px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:9px;font:800 19px "DejaVu Sans Mono",monospace;box-shadow:inset 0 -4px 0 rgba(0,0,0,.28),0 6px 14px rgba(0,0,0,.5)}
.what{padding:7px 14px;border-radius:999px;font-weight:700;box-shadow:0 6px 14px rgba(0,0,0,.5)}
</style><div class="win"><div class="bar"><div class="dot" style="background:#ff5f57"></div><div class="dot" style="background:#febc2e"></div><div class="dot" style="background:#28c840"></div><div class="t">${esc(title)}</div></div><pre>${rows.map(r => `<div>${r}</div>`).join('')}</pre><div class="fx">${overlay}</div></div>`

}
const browser = await chromium.launch()
const tab = await browser.newPage({ deviceScaleFactor: 2 })
const html = join(process.env.OUT ?? dirname(new URL(import.meta.url).pathname), 'page.html')
for (let i = 0; i < pairs.length; i += 2) {
  writeFileSync(html, pageFor(pairs[i]))
  await tab.goto('file://' + html)
  await tab.evaluate(() => document.fonts.ready)
  await (await tab.$('body')).screenshot({ path: pairs[i + 1], omitBackground: true })
}
await browser.close()
