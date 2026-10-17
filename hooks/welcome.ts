// The welcome art, after the commit-walk logo: a sunflower in green sneakers
// walking a commit line. Lucia's large and smaller sunflowers where the pane
// has room, a small drawn one otherwise. Each art row has a mask row of the same length
// naming the tone of every character; `artRuns` turns a row into coloured runs.

export type Tone =
  | 'petal' | 'petalEdge' | 'face' | 'faceEdge' | 'eye' | 'mouth' | 'leaf' | 'leafEdge'
  | 'stem' | 'shoe' | 'shoeEdge' | 'motion' | 'line' | 'blue' | 'green' | 'yellow' | 'red'

const TONE_OF: Record<string, Tone> = {
  p: 'petal', P: 'petalEdge', f: 'face', F: 'faceEdge', e: 'eye', m: 'mouth', l: 'leaf', L: 'leafEdge',
  s: 'stem', h: 'shoe', H: 'shoeEdge', w: 'motion', d: 'line', B: 'blue', G: 'green', Y: 'yellow', R: 'red',
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
}

/** Tones drawn dim. */
export const DIM_TONES: ReadonlySet<Tone> = new Set<Tone>(['motion', 'line'])

export type Art = { rows: readonly string[]; mask: readonly string[]; width: number }

function art(rows: readonly string[], mask: readonly string[]): Art {
  return { rows, mask, width: Math.max(...rows.map(row => row.length)) }
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

/** Lucia's smaller sunflower, 45 × 22: the usual welcome art. */
export const MEDIUM = art([
  "                       .--",
  "             -+----  .-...--",
  "             +.....-++.....+. .---.",
  "       .-----#......-+.....++-....+",
  "       -......+-.....+--...+......+  .+.",
  "       --......-+-++++++++#-.....-- .-  .-.",
  "       -++---..-#-----------+-..++--   --",
  "    -+-......-++----------++-+#-....--",
  "    --........#----++-----##--#.....--",
  "    .-+.......#----##+---+++--#-..-+.",
  "++++-+++#++++-#-----+++++#+---#--++++++++-.",
  "++-------#+....#+-----++++---#-....++----++",
  " +++++++#+......+#+-------++#-.....-#+--++",
  "  -+++++#-.....-+..-++++++-..-+----+++++.",
  "    .----+-----#......--......# .-----.",
  "               #-.....++-.....+",
  "             -###+..--   .-++#.    ...  .- .",
  "          .++###  ..        +##+---.  -. +.--",
  "        .-..+---            .+.+---.-++.   -",
  "       .-----+--..           #----+#+-",
  "        ..-..-. .-           .--+#-.",
  "           ....---             ."
],
[
  "                       pPP",
  "             PPPPPP  pPpppPP",
  "             PpppppPPPpppppPp pPPPp",
  "       pPPPPPPppppppPPpppppPPPppppP",
  "       PppppppPPpppppPPPpppPppppppP  www",
  "       PPppppppPPPPFFFFFFFFFpppppPP ww  www",
  "       PPffffppfFfffffffffffffppPPPw   ww",
  "    PPPppppppfffffffffffffffffPPppppPP",
  "    PPppppppppefffffffffffeeffFpppppPP",
  "    pPPpppppppeffffeefffffffffFPppPPp",
  "llllllllPfffffeffffffffffeffffFlllllllllllp",
  "lllllllllPfppppFfffffffffffffFfppppllllllll",
  " lllllllLfppppppfFffffffffffFfppppplLlllll",
  "  llllllLfpppppffppffffffffppfflllllllllp",
  "    pLLLLPPPPPPPppppppFFppppppP plllllp",
  "               hhhhhhhhhhhhhhhh",
  "             hhhhhhhhh   hhhhhh    www  ww w",
  "          hhhhhh  hh        hhhhhhww  ww wwww",
  "        hhhhhhhh            hhhhhhwwwwww   w",
  "       hhhhhhhhhhh           hhhhhwwww",
  "        hhhhhhh hh           hhhhhww",
  "           hhhhhhh             h"
])

/** The small sunflower, commit line included: the fallback for short or narrow panes. */
export const SMALL = art([
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
],
[
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
])

export type Run = { text: string; tone: Tone | null }

/** One art row as runs of one tone each; spaces carry no tone. */
export function artRuns(source: Art, row: number): Run[] {
  const text = source.rows[row] ?? ''
  const mask = source.mask[row] ?? ''
  const runs: Run[] = []
  for (let i = 0; i < text.length; i++) {
    const tone = text[i] === ' ' ? null : (TONE_OF[mask[i] ?? ' '] ?? null)
    const last = runs[runs.length - 1]
    if (last && last.tone === tone) last.text += text[i]
    else runs.push({ text: text[i] ?? '', tone })
  }
  return runs
}
