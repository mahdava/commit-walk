# commit-walk

A Claude Code pane for reading a Git repository worktree by worktree and
commit by commit. Each changed file can be shown as a diff, or as the whole
file after or before the commit. Everything comes from git, read-only. The
model gets no tool, and nothing is written to the repository.

## Install

The repository is private: installing needs read access to it on GitHub and
a git credential for github.com on the machine (an SSH key, or
`gh auth login` then `gh auth setup-git`).

At the prompt of a Claude Code terminal session:

```
/plugin install commit-walk --marketplace mahdava/commit-walk
```

From a shell:

```
claude plugin install commit-walk --marketplace mahdava/commit-walk
```

Answer `y` to add the marketplace, then pick the user scope. A running
session picks it up at once; in the desktop app, add the marketplace
`mahdava/commit-walk` under + → Plugins, then add the plugin.

## Use

Start Claude Code inside a Git repository, then:

| Command | What it does |
| --- | --- |
| `/commits` | Opens the pane, or closes it when it is open |
| `/commits refresh` | Opens the pane, or re-reads the repository |
| `/commits close` | Closes the pane |

`/commits` runs at once, even while Claude is working. (It is not `/review`: Claude Code keeps that name as an alias of its built-in `/code-review`.)

In the pane, Tab and the arrows move between the controls. The pane also
answers these keys while it holds the keyboard:

| Key | Action |
| --- | --- |
| `o` / `n` | Older / newer commit |
| `k` / `j` | Previous / next file |
| `d` / `a` / `b` | Diff / After / Before |
| `r` | Refresh |
| `Esc` | Close |

The worktree, commit and file pickers list every worktree, the last 100
commits and up to 400 files of a commit.

## Behaviour

- **The session's worktree comes first.** The pane opens on the worktree
  that holds the session's folder, at its newest commit.
- **It follows new work.** While the newest commit is selected, the pane
  moves to each new commit. That happens after Claude edits a file or runs a
  command that is not read-only, and after each turn. On an older commit it
  stays where it is.
- **Diffs show the whole file** when it fits. Larger diffs fall back to 20
  lines of context. Longer files are cut on a line boundary, and the pane
  says so.
- **Merges are compared with their first parent.** A root commit is
  compared with the empty tree.
- **Renames are diffed as renames.** Before shows the old path.
- **Binary files are only listed.** The same goes for blobs over 4 MB.
- **Git runs without optional locks**, so the pane never contends with an
  agent writing the index. Paths with spaces or non-ASCII names are read
  NUL-separated.
- **A hot reload keeps your place.** The selection and the loaded data live
  in the session's plugin state.

## Develop

```
claude plugin validate ~/.claude/mods/commit-walk
claude plugin test ~/.claude/mods/commit-walk
```

`hooks/git.ts` holds the git commands and parsers and makes no engine
calls. `hooks/register.tsx` holds the hooks and the pane. `types/index.d.ts`
is the state contract. The tests use canned git output, because the kit has
no process access. After a change, a running session picks it up with
`/reload-plugins`.

On Lucia's machine it is also listed in the local marketplace `lucia-mods`
(`~/.claude/mods`), installed as `commit-walk@lucia-mods`.

## Ideas not built yet

- A "Working tree" entry for uncommitted changes.
- A small "new commit" marker while pinned to an older commit.
- Remembering the last worktree across sessions.
- Picking the parent a merge is compared with.
