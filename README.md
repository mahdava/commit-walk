# commit-walk

A Claude Code pane for walking a Git repository worktree by worktree and
commit by commit. Pick a worktree, a commit and one of its changed files.
Read the file as a diff, or as the whole file after or before the commit.

It is built for watching an agent's work as it lands. The pane follows new
commits while Claude edits, and it can step back through history without
leaving the session.

Everything comes from git and is only read. The plugin gives the model no
tool, writes nothing to the repository and makes no network requests.

```
 Commit walk
 notsofast  [ Refresh ]
 Following the newest commit

 Worktree  main  ·  notsofast                                ▾

 Commit    ae6ad8e  Merge pull request #199 from mahdava/…   ▾
 Lucia · 6 days ago · merge, against its first parent · 1 of 100
 [ Older ]  [ Newer ]

 File      M  web/app/audit/page.tsx  +42 −3                 ▾
 [ Prev file ]  [ Next file ]  9 of 14

 [ Diff ]  [ After ]  [ Before ]

   12    const rows = useAuditRows(filters)
   13  - return <Table rows={rows} />
   13  + return <AuditTable rows={rows} density="compact" />
 …
 keys: o/n commit · k/j file · d/a/b view · r refresh · Esc close
```

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Use](#use)
- [What the pane shows](#what-the-pane-shows)
- [How it behaves](#how-it-behaves)
- [Limits](#limits)
- [What it runs](#what-it-runs)
- [Troubleshooting](#troubleshooting)
- [Develop](#develop)
- [Ideas not built yet](#ideas-not-built-yet)

## Requirements

| What | Version |
| --- | --- |
| Claude Code | 2.1.300 or later, for the mods API. Tested on 2.1.300 to 2.1.302. |
| Git | 2.36 or later, for NUL-separated `git worktree list` output |

The pickers need the terminal, the desktop app or VS Code. The mobile app
has no picker element. There the pane shows the current values and moves
with the step buttons only.

## Install

The repository is private. Installing needs read access to it on GitHub and
a git credential for github.com on the machine. That is an SSH key, or
`gh auth login` followed by `gh auth setup-git`. The install never prompts
for a credential.

At the prompt of a Claude Code terminal session:

```
/plugin install commit-walk --marketplace mahdava/commit-walk
```

Or from a shell:

```
claude plugin install commit-walk --marketplace mahdava/commit-walk
```

Answer `y` to add the marketplace, then pick the user scope. The plugin is
active at once in that session, and in every session started afterwards.

In the desktop app, where `/plugin` does not run, click + next to the prompt
box, then Plugins. Add the marketplace `mahdava/commit-walk`, then add the
plugin.

To update later:

```
claude plugin marketplace update commit-walk
claude plugin update commit-walk@commit-walk
```

To remove it:

```
claude plugin uninstall commit-walk@commit-walk
```

## Use

Start Claude Code inside a Git repository, then run `/commits`.

| Command | What it does |
| --- | --- |
| `/commits` | Opens the pane, or closes it when it is open |
| `/commits refresh` | Opens the pane if needed and reads the repository again |
| `/commits close` | Closes the pane |

`/commits` runs at once, even in the middle of a turn. It is not called
`/review` because Claude Code keeps that name as an alias of its built-in
`/code-review`.

### Keyboard

The pane takes the keyboard when it opens. Later, click it, or press
`ctrl+x` then `Tab`, to give it the keyboard again. While it has the
keyboard:

| Key | Action |
| --- | --- |
| `Tab` | Moves between the controls |
| `Enter` | Opens the focused picker or presses the focused button |
| Arrows | Scroll the pane |
| `o` / `n` | Older / newer commit |
| `k` / `j` | Previous / next file |
| `d` / `a` / `b` | Diff / After / Before |
| `r` | Refresh |
| `Esc` | Closes the pane |

## What the pane shows

From the top down:

1. **The repository's name** and a Refresh button. Under them, a line says
   whether the pane follows the newest commit or is pinned to an older one.
   It shows "Loading…" while git runs, and git's message if a step failed.
2. **Worktree.** Every worktree of the repository, shown as its branch, or
   "detached @ sha" without one, then its folder name. Locked worktrees are
   marked. Bare and prunable ones are left out.
3. **Commit.** The newest 100 commits of that worktree's HEAD, by short SHA
   and subject. Under it are the author, the relative date, whether it is a
   merge or the root commit, and its position in the list.
4. **File.** The files the commit changed, with their status letter and line
   counts. Renames show as `old → new`, and binary files say "binary".
5. **The view**, one of three:

| View | Shows |
| --- | --- |
| Diff | The change, coloured, with line numbers from git's hunks |
| After | The whole file as the commit left it, numbered from line 1 |
| Before | The whole file as it was in the commit's first parent |

The status letters are git's own:

| Letter | Meaning |
| --- | --- |
| `A` | Added |
| `M` | Modified |
| `D` | Deleted |
| `R` | Renamed, possibly with changes |
| `C` | Copied |
| `T` | Type changed, for example a file became a symlink |
| `U` | Unmerged |

## How it behaves

- **It starts where you are.** The pane opens on the worktree that holds the
  session's folder, at its newest commit and first changed file.
- **It follows new work.** While the newest commit is selected, a refresh
  moves to the new newest commit. Refreshes happen after Claude's successful
  Edit, Write, NotebookEdit and non-read-only Bash calls, and after each
  turn, about 0.4 s after the last one. They run only while the pane is open.
- **It stays put on history.** On an older commit, a refresh keeps that
  commit and file, as long as they still exist.
- **Selections are by identity.** The pane remembers the worktree path, the
  commit SHA and the file path, not list positions. New commits never shift
  what you are looking at.
- **Diffs show the whole file** when it fits in the pane. Bigger changes fall
  back to 20 lines of context around each change, and the pane says so.
- **Merges compare with their first parent**, the branch that was merged
  into. A root commit compares with the empty tree.
- **Renames diff as renames.** Before reads the file under its old path.
- **A failure keeps what loaded.** If one git step fails, the pane keeps
  what it had and prints git's message. Outside a repository it says so and
  offers to try again.
- **Fast clicks never show stale results.** When a newer selection starts
  loading, the older load is dropped.
- **A plugin reload keeps your place.** The selection and the loaded data
  live in the session's plugin state, which survives a hot reload.

## Limits

| What | Limit | Past it |
| --- | --- | --- |
| Commits listed | 100 newest | Older commits are not reachable from the pane |
| Files listed per commit | 400 | The pane says how many are left out |
| Text in the view | 60,000 characters | Cut on a line or hunk boundary, with a note |
| File size for After and Before | 4 MB | A note instead of the file |
| One git command | 20 s | That step fails and shows the error |

Binary files are listed but not shown. There is no view of uncommitted
changes yet.

## What it runs

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

## Troubleshooting

**`/commits` does not exist.** The plugin is not loaded in this session. Run
`/reload-plugins`, or start a new session. `claude plugin list` should show
`commit-walk` as enabled.

**"No repository to review".** The session's folder is not inside a Git
repository. Start Claude Code inside one.

**"Commit walk is open but not drawn yet".** No surface could place the
pane. A headless `claude -p` run draws nothing. In a terminal, widen the
window.

**The pane closed right after opening.** Claude Code refused to draw it.
Start Claude Code with `--debug` and look for a `ui.render (Pane) refused`
line naming commit-walk.

**A diff draws as plain text.** The diff was not in a form the code view
can colour. The debug log gives the reason on a line containing
"drawn as plain code".

**The pane does not follow Claude's commits.** It follows only while the
newest commit is selected. Press `n` until Newer is dimmed, or press `r`.

## Develop

The plugin is a Claude Code mod: a hooks module that runs inside Claude
Code's own plugin environment, with no Node APIs.

| File | Holds |
| --- | --- |
| `hooks/git.ts` | The git commands and NUL-safe parsers. It makes no engine calls, so tests drive it with canned output. |
| `hooks/register.tsx` | The hooks: the command, the refresh triggers and the pane |
| `types/index.d.ts` | The state contract: the values kept in the session's plugin state |
| `tests/git.test.ts` | Parser and fitting tests |
| `tests/pane.test.tsx` | Pane tests on the terminal, desktop and mobile surfaces |
| `.claude-plugin/plugin.json` | The manifest |
| `.claude-plugin/marketplace.json` | Makes the repository its own marketplace |

Checks:

```
claude plugin validate .
claude plugin test .
```

`claude plugin validate` reads the manifest, the marketplace file and the
module, and reports anything Claude Code would refuse. `claude plugin test`
runs the tests inside Claude Code's own plugin host.

Type-checking uses the API types that Claude Code writes into
`.claude-plugin/types/` when a session loads the plugin from a local folder,
as with `--plugin-dir` below. That folder is git-ignored. Once it exists:

```
npx -p typescript tsc -p .
```

To work on a local copy, start a session with the folder loaded:

```
claude --plugin-dir /path/to/commit-walk
```

Edits reload when the turn that made them ends. An installed copy picks up
changes with `/reload-plugins`.

Bump `version` in `.claude-plugin/plugin.json` with each change meant to
reach installs.

## Ideas not built yet

- A "Working tree" entry for uncommitted changes.
- A small "new commit" marker while pinned to an older commit.
- Remembering the last worktree across sessions.
- Picking which parent a merge compares with.
- Paging further back than 100 commits.
