// Text from git made safe to draw, and honest to read.
//
// Claude Code refuses a whole drawing when any of its text holds a control
// character other than tab, line feed and carriage return, and the pane comes
// out blank. A commit subject, an author, a path or a file can hold one (a
// colour code, a form feed), so each is shown as its visible symbol instead:
// ESC as ␛, form feed as ␌.
//
// Some other characters draw as nothing, or reorder the text around them, so
// code can read differently from what it does ("Trojan Source"). Each is shown
// as a short marker such as ⟨RLO⟩, so the pane shows the text in the order
// git holds it. The zero-width joiner and non-joiner are left alone: emoji and
// scripts such as Persian and Hindi need them.

/** What Claude Code refuses to draw: C0 controls but tab, LF and CR; DEL; the C1 controls. */
const UNDRAWABLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/

/** Characters that draw as nothing or reorder text, by the marker each is shown as. */
const INVISIBLE: Record<string, string> = {
  '­': 'SHY',
  '؜': 'ALM',
  '᠎': 'MVS',
  '​': 'ZWSP',
  '‎': 'LRM',
  '‏': 'RLM',
  ' ': 'LS',
  ' ': 'PS',
  '‪': 'LRE',
  '‫': 'RLE',
  '‬': 'PDF',
  '‭': 'LRO',
  '‮': 'RLO',
  '⁠': 'WJ',
  '⁡': 'FA',
  '⁢': 'IT',
  '⁣': 'IS',
  '⁤': 'IP',
  '⁦': 'LRI',
  '⁧': 'RLI',
  '⁨': 'FSI',
  '⁩': 'PDI',
  '﻿': 'BOM',
}

const HIDDEN = new RegExp(`${UNDRAWABLE.source.slice(0, -1)}${Object.keys(INVISIBLE).join('')}]`)
const HIDDEN_ALL = new RegExp(HIDDEN.source, 'g')
const BREAKS = /[\t\n\r]/g

/** A hidden character's symbol: its marker, its Control Pictures glyph, or � for the C1 range, which has none. */
function symbolOf(char: string): string {
  const marker = INVISIBLE[char]
  if (marker) return `⟨${marker}⟩`
  const code = char.charCodeAt(0)
  if (code < 0x20) return String.fromCharCode(0x2400 + code)
  if (code === 0x7f) return '␡'
  return '�'
}

/** Whether `text` holds a character the pane shows as a symbol or marker. */
export function hasHidden(text: string): boolean {
  return HIDDEN.test(text)
}

/** Text for a block (a file, a diff, a message): tabs and line breaks stay. */
export function printable(text: string): string {
  return text.replace(HIDDEN_ALL, symbolOf)
}

/** Text for one line (a button's label): tabs and line breaks become spaces too. */
export function printableLine(text: string): string {
  return printable(text).replace(BREAKS, ' ')
}
