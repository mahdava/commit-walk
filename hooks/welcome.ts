// The welcome art, after the commit-walk logo: a sunflower in green sneakers
// walking a commit line. Lucia's large and smaller sunflowers where the pane
// has room, a small drawn one otherwise. Each art row has a mask row of the same length
// naming the tone of every character; `artRuns` turns a row into coloured runs.

export type Tone =
  | 'petal' | 'petalEdge' | 'face' | 'faceEdge' | 'eye' | 'mouth' | 'leaf' | 'leafEdge'
  | 'stem' | 'shoe' | 'shoeEdge' | 'motion' | 'line' | 'blue' | 'green' | 'yellow' | 'red'
  | 'faceDark' | 'leafDark' | 'smile' | 'sole'

const TONE_OF: Record<string, Tone> = {
  p: 'petal', P: 'petalEdge', f: 'face', F: 'faceEdge', e: 'eye', m: 'mouth', l: 'leaf', L: 'leafEdge',
  s: 'stem', h: 'shoe', H: 'shoeEdge', w: 'motion', d: 'line', B: 'blue', G: 'green', Y: 'yellow', R: 'red',
  x: 'faceDark', k: 'leafDark', u: 'smile', o: 'sole',
}

/** Raw colours, after the logo; `undefined` keeps the theme's own text colour. */
export const TONE_COLOR: Record<Tone, string | undefined> = {
  petal: '#F5B800',
  petalEdge: '#E08A00',
  face: '#B5651D',
  faceEdge: '#7A3E12',
  eye: undefined,
  mouth: '#F05A6E',
  leaf: '#2EA043',
  leafEdge: '#1F7A30',
  stem: '#2EA043',
  shoe: '#2EA043',
  shoeEdge: '#1F7A30',
  motion: undefined,
  line: undefined,
  blue: '#3B82F6',
  green: '#2EA043',
  yellow: '#F5B800',
  red: '#EF4444',
  // Colours Lucia added when she recoloured the medium sunflower.
  faceDark: '#2A1104',
  leafDark: '#0F5106',
  smile: '#F05151',
  sole: '#BFBBBB',
}

/** Tones drawn dim. */
export const DIM_TONES: ReadonlySet<Tone> = new Set<Tone>(['motion', 'line'])

/**
 * A drawing: its rows, and either a mask row per row naming each character's
 * tone, or a palette giving every character its own colour (drawings made in
 * the ASCII Fantasy Map Builder, which colours by character).
 */
export type Art = { rows: readonly string[]; mask: readonly string[]; palette?: Readonly<Record<string, string>>; width: number }

function art(rows: readonly string[], mask: readonly string[], palette?: Record<string, string>): Art {
  return { rows, mask, palette, width: Math.max(...rows.map(row => row.length)) }
}

/** The commit line the sunflower walks on: four commits in the logo's colours. */
export const COMMIT_LINE = art(
  ["  ●━━━━━━━━━━━●━━━━━━━━━━━●━━━━━━━━━━━●".trim()],
  ["  BdddddddddddGdddddddddddYdddddddddddR".trim()],
)

/** Lucia's sunflower, 71 × 36: drawn where the pane is wide and tall enough. */
export const LARGE = art([
  "                                      .--",
  "                                    -#+.+#-",
  "                      #+--+##+    -#-.....+#",
  "                     +#.......##.+#........#+",
  "                     #..........##..........#. -+#####+",
  "              .---. .#...........#-.........###-......++",
  "           .#+-...--+#+..........+#.........#.........+#     +-",
  "           .#..........##........-#-.......#+.........++   .##.",
  "            #...........-#-...-+########+-#+.........-#   .#+",
  "            -#...........-#+##+----------+##+........#-    .    +##+",
  "             ##++-.......-#+----------------+#-....-##-.      ###.",
  "         -##+--..--+##-.+#--------------------##++#+...-+#+",
  "       ##-............###----------------------#+..........#.",
  "       #+..............#-----------------+#+#---#-........++",
  "        #+............##------+#++--------###+--##.......+#",
  "         +#-..........##------####---------++---##.....-#-",
  " .+##########+......-+##-------###-#######------#######. .++#++-",
  "-#----------+#######+..#+----------+#---##-----+#....+###+------###.",
  ".#+------------###.....-#+----------##++#+-----#-......+#---------+#-",
  " -#+++++++#+---#-.......-##------------------+#+........-####----+#+",
  "  -#++++-++++##+..........-##+------------++##+..........#+-----+#-",
  "   -#+-++++--+#-..........#+.+###++--++####-..+#.........+#---+##.",
  "     +##+++--+#-........-#-......--+#+--.......+###+++###+-++##-",
  "        +#####++.....+###-..........++.........-#   -#######.",
  "               .-++--   ++..........##-........-#",
  "                        ##-........#+.#+.......-#",
  "                      .####-.....+#-   .##+-..-#.               -#.",
  "                   --+####++#--##-        .+####+      -+-.-+-   -#  #+",
  "                 .#++####    -.              #####+###++   .-+-  .#. +#",
  "                #+------#                     ##++--+-+--. .-++  ++  #+",
  "              +#-  --.--+                    -#. ---++-  ##+##      #-",
  "             #--+---+---+#.                   #+.-+--..#####.",
  "            .#  +.++-+++   +-                 .#+.- .#++##",
  "              .+- ...--....-#.                 +- -####-",
  "                 .++-    ...#                   -##+.",
  "                     .-++++-"
],
[
  "                                      pPP",
  "                                    PPPpPPP",
  "                      PPPPPPPP    PPPpppppPP",
  "                     PPpppppppPPpPPppppppppPP",
  "                     PppppppppppPPppppppppppPp PPPPPPPP",
  "              pPPPp pPpppppppppppPPpppppppppPPPPppppppPP",
  "           pPPPpppPPPPPppppppppppPPpppppppppPpppppppppPP     ww",
  "           pPppppppppppPPppppppppPPPpppppppPPpppppppppPP   wwww",
  "            PpppppppppppfPfpppffFFFFFFFFffFfpppppppppPP   www",
  "            PPpppppppppppfFfFFffffffffffffFFfppppppppPP    w    wwww",
  "             PPPPPpppppppfFffffffffffffffffffFfppppPPPPp      wwww",
  "         PPPPPPppPPPPPfpfFffffffffffffffffffffFFffPPpppPPPP",
  "       PPPppppppppppppPPFffffffffffffffffffffffFfppppppppppPp",
  "       PPppppppppppppppFffffffffffffffffffefefffFfppppppppPP",
  "        PPppppppppppppPFfffffffeffffffffffeeefffFPpppppppPP",
  "         lPlppppppppppPFffffffeeeeffffffffffffffFPppppplPl",
  " plLLLLLLLLLLlpppppplfPFfffffffeeefeeeeeeeffffffFPPPPPPp pllLlll",
  "lLlllllllllllLLPPPPPlppFffffffffffffefffeeffffffFpppplPPLlllllllLLLp",
  "pLlllllllllllllLPPpppppfFfffffffffffeeffeffffffFfpppppplPllllllllllLl",
  " lLlllllllLllllLlpppppppfFFfffffffffffffffffffFfpppppppplLLLLlllllLl",
  "  lLlllllllllLLlppppppppppfeefffffffffffffffeefppppppppppLlllllllLl",
  "   lLlllllllllLlppppppppppPfpfPFFffffffFFFPfppfPppppppppplLllllLLp",
  "     lLLllllllLlppppppppfPfppppppfffFfffpppppppfPPPlllPPPllllLLl",
  "        lLLLLLllpppppPPPPPppppppppppFFpppppppppPP   lPPPPLLLp",
  "               plllll   PPppppppppppPPPppppppppPP",
  "                        PPPppppppppPPpPPpppppppPP",
  "                      pPPPPPpppppPPP   pPPPPppPPp               lLp",
  "                   hhhHHHHhhPhhPPh        hhPPPPh      hhhhhhh   ww  ww",
  "                 hHhhHHHH    hh              HHHHHhHHHhh   hhhw  www ww",
  "                HhhhhhhhH                     HHhhhhhhhhhh hhhw  ww  ww",
  "              hHh  hhhhhh                    hHh hhhhhh  HHhHH      ww",
  "             HhhhhhhhhhhhHh                   HhhhhhhhhHHHHHh",
  "            hH  hhhhhhhh   hh                 hHhhh hHhhHH",
  "              hhh hhhhhhhhhhHh                 hh hHHHHh",
  "                 hhhh    hhhH                   hHHhh",
  "                     hhhhhhh"
])

/** Lucia's smaller sunflower, 45 × 22, as she recoloured it: the usual welcome art. */
export const MEDIUM = art([
  "                       .--",
  "             -+----  .-...--",
  "             +.....-##.....#. .---.",
  "       .-----#......-#.....#+-....+",
  "       #......#-.....#--...#......+  .+.",
  "       #-......#+-++++++++#-.....#- .-  .-.",
  "       #++---..-#-----------+-.##+--   --",
  "    ###.#....-+#--------------#-....--",
  "    -#...#---.##----#------#--#.....--",
  "    .-#.......#-----#------#--#-..-+.",
  "++++-+++#++++-#---------Ս-----#--++++++++--",
  "++-------#+....#+------------#-....++----++",
  " +++++++#+......#-+--------+#-.....-#+--++",
  "  -+++++#-.....------+++++-..-+----+++++-",
  "    -----+-----#......--......# -------",
  "               #-.....++-.....+",
  "             -###+..--   .-++#.    ...  .- .",
  "          .#####  ..        +##+####  -. +.--",
  "        .#O.####            .#++---+#++.   -",
  "       .#----+-#..          #O-----#+-",
  "        .#-..-. ##          #+----#.",
  "           ....---           #+++"
],
[
  "                       pPP",
  "             PPPPPP  pPpppPP",
  "             PpppppPPPpppppPp pPPPp",
  "       pPPPPPPppppppPPpppppPPPppppP",
  "       PppppppPPpppppPPPpppPppppppP  www",
  "       PPppppppPPPPFFFFFFFFFpppppPP ww  www",
  "       PPffffppfFfffffffffffffpPPPPw   ww",
  "    PPPpPppppffFffffffffFFFFFFPPppppPP",
  "    PPpppPPPPpFFffffeffffffeffFpppppPP",
  "    pPPpppppppFfffffxffffffxffFPppPPp",
  "llllllllPfffffFfffffffffufffffFllllllllllll",
  "lllllllllPfppppFfffffffffffffFfppppllllllll",
  " kkkkkkkkfppppppFFffffffffffFfpppppkkkkkkk",
  "  kkkkkkkfpppppfFFFFFffffffppffkkkkkkkkkk",
  "    kkkkkPPPPPPPppppppFFppppppP kkkkkkk",
  "               llllllllllllllll",
  "             lllllllll   llllll    www  ww w",
  "          kkklll  ll        llllkkkk  ww wwww",
  "        kkokkkkk            kkkkkkkkkwww   w",
  "       kkkkkkkkkkk          kokkkkkkww",
  "        kkkkkkk kk          kkkkkkkw",
  "           kkkkkkk           kkkk"
])

/** The commit line under the small sunflower: the same four commits on a 22-column track. */
export const SMALL_LINE = art(["●━━━━━━●━━━━━━●━━━━━━●"], ["BddddddGddddddYddddddR"])

/** Lucia's small sunflower, 23 × 11, made in the ASCII Fantasy Map Builder: each character in its palette colour. */
export const SMALL = art(
[
  "          ##",
  "    ###  #..#   ##",
  "   ##..###..####..#",
  "    #..#@///// #..#",
  "   ###@//●//●//####==",
  "==#....@///ᵕ///#...#===",
  " ==### @////// #..##==",
  "   ===  I    I  oo",
  "       I      Iooo",
  "      ooo     ooo",
  "      ooooo"
],
  [],
{
    "#": "#c49a03",
    ".": "#c49a03",
    "/": "#421e05",
    "=": "#2d6d2d",
    "@": "#421e05",
    "I": "#2d6d2d",
    "o": "#0f5106",
    "ᵕ": "#f05151",
    "●": "#ffffff"
  },
)

/** A stretch of one colour: a tone from the masks, or a palette colour; neither for spaces. */
export type Run = { text: string; tone: Tone | null; color?: string }

/** One art row as runs of one tone each; spaces carry no tone. */
export function artRuns(source: Art, row: number): Run[] {
  const text = source.rows[row] ?? ''
  const mask = source.mask[row] ?? ''
  const runs: Run[] = []
  if (source.palette) {
    const palette = source.palette
    for (const ch of text) {
      const color = ch === ' ' ? undefined : palette[ch]
      const last = runs[runs.length - 1]
      if (last && last.color === color) last.text += ch
      else runs.push({ text: ch, tone: null, color })
    }
    return runs
  }
  for (let i = 0; i < text.length; i++) {
    const tone = text[i] === ' ' ? null : (TONE_OF[mask[i] ?? ' '] ?? null)
    const last = runs[runs.length - 1]
    if (last && last.tone === tone) last.text += text[i]
    else runs.push({ text: text[i] ?? '', tone })
  }
  return runs
}
