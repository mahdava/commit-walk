#!/usr/bin/env bash
# make-media.sh: remakes the README's screenshots and demo from a real session.
#
# It builds the throwaway trail-notes repository, runs Claude Code in a tmux
# server of its own, walks the branch with keys and clicks, and captures the
# screen after every step. render.mjs draws the captures as terminal windows
# and ffmpeg joins them into the GIF and MP4. Results land in ../../assets.
#
# Needs: tmux, ffmpeg, node, claude with commit-walk installed, Playwright
# (PLAYWRIGHT_FROM=<folder whose node_modules has it>), and a font with ⎿ and ⏸
# (SYMBOL_FONT=<path>, for example Segoe UI Symbol). Claude Code runs with no
# tools and ANTHROPIC_API_KEY unset; nothing is sent to the model.
#
#   PLAYWRIGHT_FROM=~/some/app SYMBOL_FONT=/mnt/c/Windows/Fonts/seguisym.ttf ./make-media.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ASSETS=$HERE/../../assets
DEMO=${DEMO:-$HOME/code/trail-notes}
export OUT=${OUT:-$(mktemp -d)}
export COLS=128
T="tmux -L cwshots"

"$HERE/make-demo-repo.sh" "$DEMO"

# The pane opens at the dock width you last dragged it to, kept in
# ~/.claude.json. Record at a fixed 76 columns and put yours back after.
dock() { node -e '
const fs = require("fs"), f = process.env.HOME + "/.claude.json", c = JSON.parse(fs.readFileSync(f, "utf8"))
const was = c.pluginPanes?.dockColumns
if (process.argv[1] !== "") { c.pluginPanes = { ...c.pluginPanes, dockColumns: Number(process.argv[1]) } } else if (c.pluginPanes) delete c.pluginPanes.dockColumns
fs.writeFileSync(f + ".tmp", JSON.stringify(c, null, 2)); fs.renameSync(f + ".tmp", f); console.log(was ?? "")' "$1"; }
WAS_DOCK=$(dock 76)
trap 'dock "$WAS_DOCK" > /dev/null' EXIT

# Claude Code in the demo repository, cols × rows, on the given branch.
start() {
  git -C "$DEMO" switch -q "$3"
  $T kill-server 2>/dev/null || true; sleep 1
  $T -f "$HERE/tmux.conf" new-session -d -s s -x "$1" -y "$2" -c "$DEMO" \
    -e COLORTERM=truecolor -e CLAUDE_CODE_TMUX_TRUECOLOR=1 \
    "env -u ANTHROPIC_API_KEY claude --tools '' --settings '{\"enabledPlugins\":{\"nsf-approvals@lucia-mods\":false}}'; sleep 600"
  for _ in $(seq 1 20); do
    sleep 1
    # The first run in a new folder asks to trust it: this script just made it.
    if $T capture-pane -pt s | grep -q "trust this folder"; then $T send-keys -t s Down; sleep 0.5; $T send-keys -t s Enter; sleep 5; break; fi
    $T capture-pane -pt s | grep -q "Claude Code v" && break
  done
  sleep 2
}
n=0; mkdir -p "$OUT/frames"; : > "$OUT/frames/durations"
# shot <seconds> [json]: a capture, how long it shows, and what is being done in it.
shot() {
  n=$((n+1)); local f="$OUT/frames/$(printf %02d $n)"
  $T capture-pane -eNpt s > "$f.ansi"; echo "$1" >> "$OUT/frames/durations"
  if [ -n "${2:-}" ]; then echo "$2" > "$f.json"; fi
}
# key <key> <what it does> <seconds>: press it and show it pressed.
key() { $T send-keys -t s "$1"; sleep 1.2; shot "$3" "{\"key\":\"$1\",\"label\":\"$2\"}"; }
# click <text on screen> <column offset> <seconds>: point at it, click, show the result.
click() {
  local c r; read -r c r < <(at "$1"); c=$((c + $2))
  shot 0.9 "{\"pointer\":[$c,$r]}"
  "$HERE/click.sh" "$c" "$r"; sleep 1.2
  shot "$3" "{\"pointer\":[$c,$r],\"ring\":true}"
}
# Where text first shows on screen, as "col row".
at() { $T capture-pane -pt s | awk -v s="$1" 'i=index($0,s){print i" "NR; exit}'; }

# The walk: the diff still is the frame after "j next file" on the third commit.
start 128 40 feat/trail-difficulty
shot 1.0
$T send-keys -t s -l "/commit"; sleep 0.4; shot 0.4
$T send-keys -t s -l -- "-walk"; sleep 0.6; shot 1.0
$T send-keys -t s Enter; sleep 3; shot 2.4 '{"key":"Enter","label":"/commit-walk"}'
key j "next file" 2.0
key o "older commit" 1.6
key o "older commit" 1.8
key j "next file" 2.6; STILL=$(printf %02d $n)
key a "after" 1.8
key b "before" 1.8
key d "diff" 1.2
click "Commit    " 20 2.2
click "Record the climb" 0 2.4
click "[ all ]" 2 2.2
click "Commit    " 20 3.0

$T kill-server

cd "$OUT/frames"
args=()
for f in *.ansi; do args+=("$f" "${f%.ansi}.png"); done
# Video frames are opaque: ffmpeg's GIF path cannot carry the alpha, so the
# corners take the window's own colour. The stills keep transparent corners.
BACKDROP='#16181b' node "$HERE/render.mjs" "${args[@]}"
cp "$STILL.ansi" still.ansi && node "$HERE/render.mjs" still.ansi diff.png

: > list.txt
i=0
while read -r d; do i=$((i + 1)); printf "file '%02d.png'\nduration %s\n" $i "$d" >> list.txt; done < durations
printf "file '%02d.png'\n" $i >> list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i list.txt \
  -vf "fps=30,scale=1600:-2:flags=lanczos,format=yuv420p" -c:v libx264 -crf 20 -preset slow -movflags +faststart \
  "$ASSETS/commit-walk-demo.mp4"
ffmpeg -loglevel error -y -f concat -safe 0 -i list.txt \
  -vf "scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none" -fps_mode vfr \
  "$ASSETS/commit-walk-demo.gif"

mkdir -p "$ASSETS/screenshots"
cp diff.png "$ASSETS/screenshots/"
echo "Media written to $ASSETS; captures kept in $OUT. The demo repository is $DEMO."
