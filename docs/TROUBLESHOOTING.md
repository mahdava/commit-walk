<p align="center"><a href="../README.md"><img src="../assets/commit-walk-logo-outlined.svg" alt="Commit Walk, back to the README" width="320"></a></p>

# <picture><img src="../assets/sunflower-emoji.svg" alt="" width="28" height="28" align="top"></picture> Troubleshooting Commit Walk

When the pane looks empty, wrong or stuck, start here. This page lists
exactly what the plugin runs, shows how to read its debug section, and goes
through the problems seen so far with their fixes.

## <picture><img src="../assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> What it runs

Only these git commands, through Claude Code's process runner, in the
selected worktree:

| Command | For |
| --- | --- |
| `rev-parse --show-toplevel` | Finding the repository |
| `worktree list --porcelain -z` | The worktree list |
| `log -z --max-count=100 HEAD` | The commit list |
| `diff-tree -r -M -z --name-status` and `--numstat` | Changed files and line counts |
| `diff-tree -p -M --unified=…` | The diff of one file |
| `cat-file -s` and `cat-file blob` | The file before or after |
| `hash-object -t tree /dev/null` | The empty tree, for root commits |

Every command runs with `GIT_OPTIONAL_LOCKS=0`, so reading never takes
git's index lock from an agent that is committing. Output is read
NUL-separated, so paths with spaces, quotes or non-ASCII characters come
through as they are. Claude Code runs git with repository hooks turned off.

### <picture><img src="../assets/sunflower-emoji.svg" alt="" width="20" height="20" align="top"></picture> The debug section

`/commit-walk debug`, the `x` key or the Debug button shows a framed section
under the header:

- **Versions:** the plugin's and Claude Code's, and the surface.
- **The pane:** its size and placement, and which welcome art it chose.
- **Paths:** the session's folder and the repository.
- **The selection:** worktree, commit, file, view, following or pinned, and
  which list is open.
- **What loaded:** the counts, how long ago, and the last error.
- **The last 10 git commands:** exit code and time taken. A failing command
  is red and shows the first line of git's error.

It cannot help when Claude Code refuses the whole drawing, because then
nothing of the plugin is drawn. The debug log covers that case, as below.

## <picture><img src="../assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> Troubleshooting

**On a Mac with Homebrew.** The `claude-code` cask follows Claude Code's
stable channel, about a week behind the latest. commit-walk works from
2.1.292, the stable version when 1.5.0 came out. For the newest Claude Code,
install the `claude-code@latest` cask instead.

**`/commit-walk` does not exist.** The plugin is not loaded in this session. Run
`/reload-plugins`, or start a new session. `claude plugin list` should show
`commit-walk` as enabled.

**"No repository to review".** The session's folder is not inside a Git
repository. Start Claude Code inside one.

**"Commit walk is open but not drawn yet".** No surface could place the
pane. A headless `claude -p` run draws nothing. In a terminal, widen the
window.

**The pane is empty, or closed right after opening.** Claude Code refused
to draw it. Versions before 1.1.0 did this on any branch with more than 64
commits, because a picker may hold at most 64 options. Version 1.4.0 did it
on Claude Code before 2.1.300, which refuses a button holding coloured text.
Update the plugin.
Otherwise, Claude Code refused the drawing for another reason.
Start Claude Code with `--debug` and look for a line containing
`ui.render (Pane)` and `does not validate`. It names the reason.

**A diff draws as plain text.** The diff was not in a form the code view
can colour. The debug log gives the reason on a line containing
"drawn as plain code".

**The pane does not follow Claude's commits.** It follows only while the
newest commit is selected. Press `n` until Newer is dimmed, or press `r`.
