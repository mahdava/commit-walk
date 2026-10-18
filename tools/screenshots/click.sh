#!/usr/bin/env bash
# click.sh <col> <row> (1-based): a left click, as SGR mouse press + release.
tmux -L cwshots send-keys -t s -l $'\e[<0;'"$1;$2M"; sleep 0.1; tmux -L cwshots send-keys -t s -l $'\e[<0;'"$1;$2m"
