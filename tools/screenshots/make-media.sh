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
T="tmux -L cwshots"

"$HERE/make-demo-repo.sh" "$DEMO"

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
shot() { n=$((n+1)); $T capture-pane -eNpt s > "$OUT/frames/$(printf %02d $n).ansi"; echo "$1" >> "$OUT/frames/durations"; }
key() { $T send-keys -t s "$1"; sleep 1.2; }
click() { "$HERE/click.sh" "$1" "$2"; sleep 1.2; }
# Where text first shows on screen, as "col row".
at() { $T capture-pane -pt s | awk -v s="$1" 'i=index($0,s){print i" "NR; exit}'; }

# The walk: frames 08 and 12 double as the diff and commit list stills.
start 128 40 feat/trail-difficulty
shot 1.0
$T send-keys -t s -l "/commit"; sleep 0.4; shot 0.4
$T send-keys -t s -l -- "-walk"; sleep 0.6; shot 1.0
$T send-keys -t s Enter; sleep 3; shot 2.4
key j; shot 2.0
key o; shot 1.6
key o; shot 1.8
key j; shot 2.6
key a; shot 1.8
key b; shot 1.8
key d; shot 1.2
read -r c r < <(at "Commit    "); click $((c + 20)) "$r"; shot 2.2
read -r c r < <(at "Record the climb"); click "$c" "$r"; shot 2.4
read -r c r < <(at "[ all ]"); click $((c + 2)) "$r"; shot 2.2
read -r c r < <(at "Commit    "); click $((c + 20)) "$r"; shot 3.0

# The welcome screen on main, tall enough for the large sunflower.
start 128 64 main
$T send-keys -t s "/commit-walk"; sleep 1; $T send-keys -t s Enter; sleep 4
$T capture-pane -eNpt s > "$OUT/welcome.ansi"
$T kill-server

cd "$OUT/frames"
args=()
for f in *.ansi; do args+=("$f" "${f%.ansi}.png"); done
node "$HERE/render.mjs" "${args[@]}" ../welcome.ansi ../welcome.png

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
cp 08.png "$ASSETS/screenshots/diff.png"
cp 12.png "$ASSETS/screenshots/commit-list.png"
cp ../welcome.png "$ASSETS/screenshots/welcome.png"
echo "Media written to $ASSETS; captures kept in $OUT. The demo repository is $DEMO."
