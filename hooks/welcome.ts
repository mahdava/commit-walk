// The welcome art: a sunflower in sneakers walking a commit line, after the
// commit-walk logo. Each ART row has a MASK row of the same length naming the
// tone of every character; `artRuns` turns a row into coloured runs.

export type Tone = 'petal' | 'face' | 'eye' | 'mouth' | 'leaf' | 'stem' | 'shoe' | 'motion' | 'line' | 'blue' | 'green' | 'yellow' | 'red'

const TONE_OF: Record<string, Tone> = {
  p: 'petal', f: 'face', e: 'eye', m: 'mouth', l: 'leaf', s: 'stem', h: 'shoe',
  w: 'motion', d: 'line', B: 'blue', G: 'green', Y: 'yellow', R: 'red',
}

/** Raw colours, after the logo; `undefined` keeps the theme's own text colour. */
export const TONE_COLOR: Record<Tone, string | undefined> = {
  petal: '#F5B800',
  face: '#B5651D',
  eye: undefined,
  mouth: '#F05A6E',
  leaf: '#2EA043',
  stem: '#2EA043',
  shoe: '#2EA043',
  motion: undefined,
  line: undefined,
  blue: '#3B82F6',
  green: '#2EA043',
  yellow: '#F5B800',
  red: '#EF4444',
}

/** Tones drawn dim. */
export const DIM_TONES: ReadonlySet<Tone> = new Set<Tone>(['motion', 'line'])

export const ART: readonly string[] = [
  "            \\   \\ | /   /",
  "         '.  .-'''''''-.  .'",
  "      --   /  ●       ●  \\   --",
  "     ~~~  |       ◡       |  ~~~",
  "      --   \\             /   --",
  "         .'  '-._____.-'  '.",
  "       ,-.  /    | |    \\  ,-.",
  "      (__/       | |       \\__)",
  "                /   \\",
  "            ___/     \\___   ))",
  "           (____)   (____)",
  "  ●━━━━━━━━━━━●━━━━━━━━━━━●━━━━━━━━━━━●"
]

const MASK: readonly string[] = [
  "            ppppppppppppp",
  "         pp  fffffffffff  pp",
  "      pp   fffefffffffefff   pp",
  "     ppp  ffffffffmffffffff  ppp",
  "      pp   fffffffffffffff   pp",
  "         pp  fffffffffff  pp",
  "       lll  p    s s    p  lll",
  "      llll       s s       llll",
  "                sssss",
  "            hhhssssssshhh   ww",
  "           hhhhhh   hhhhhh",
  "  BdddddddddddGdddddddddddYdddddddddddR"
]

/** The widest row: below this many columns the pane draws the one-line mark instead. */
export const ART_WIDTH = Math.max(...ART.map(row => row.length))

export type Run = { text: string; tone: Tone | null }

/** One art row as runs of one tone each; spaces carry no tone. */
export function artRuns(row: number): Run[] {
  const text = ART[row] ?? ''
  const mask = MASK[row] ?? ''
  const runs: Run[] = []
  for (let i = 0; i < text.length; i++) {
    const tone = TONE_OF[mask[i] ?? ' '] ?? null
    const last = runs[runs.length - 1]
    if (last && last.tone === tone) last.text += text[i]
    else runs.push({ text: text[i] ?? '', tone })
  }
  return runs
}
