// render.mjs <in.ansi> <out.png> [<in.ansi> <out.png> …]: tmux `capture-pane -eN` dumps drawn as terminal windows.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
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
const rows = readFileSync(input, 'utf8').replace(/\n$/, '').split('\n').map(line)
return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Sym;src:url(${process.env.SYMBOL_FONT ? 'file://' + process.env.SYMBOL_FONT : 'seguisym.ttf'})}
body{margin:0;padding:28px;background:#e9e4dc;display:inline-block}
.win{border-radius:10px;overflow:hidden;box-shadow:0 12px 40px rgba(40,30,20,.28);background:${BG}}
.bar{height:30px;background:#26292d;display:flex;align-items:center;padding:0 12px;gap:7px;position:relative}
.dot{width:12px;height:12px;border-radius:50%}
.t{position:absolute;left:0;right:0;text-align:center;color:#9a9ea3;font:12px system-ui,sans-serif}
pre{margin:0;padding:10px 12px 12px;color:${FG};font:13px/15px "DejaVu Sans Mono",Sym,monospace;white-space:pre}
pre div{height:15px}
</style><div class="win"><div class="bar"><div class="dot" style="background:#ff5f57"></div><div class="dot" style="background:#febc2e"></div><div class="dot" style="background:#28c840"></div><div class="t">${esc(title)}</div></div><pre>${rows.map(r => `<div>${r}</div>`).join('')}</pre></div>`

}
const browser = await chromium.launch()
const tab = await browser.newPage({ deviceScaleFactor: 2 })
const html = join(process.env.OUT ?? dirname(new URL(import.meta.url).pathname), 'page.html')
for (let i = 0; i < pairs.length; i += 2) {
  writeFileSync(html, pageFor(pairs[i]))
  await tab.goto('file://' + html)
  await tab.evaluate(() => document.fonts.ready)
  await (await tab.$('body')).screenshot({ path: pairs[i + 1] })
}
await browser.close()
