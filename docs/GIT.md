<p align="center"><a href="../README.md"><img src="../assets/commit-walk-logo-outlined.svg" alt="Commit Walk, back to the README" width="320"></a></p>

# <picture><img src="../assets/sunflower-emoji.svg" alt="" width="28" height="28" align="top"></picture> The git commands Commit Walk runs

Commit Walk only reads. This page lists every git command it runs, the
options it runs them with, where in the code they are, and how to check the
git hooks of your own repository.

## <picture><img src="../assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> How it runs git

Each command runs through Claude Code's process runner, in the selected
worktree, as:

```
git -c core.quotepath=off --no-pager <command>
```

with this environment:

| Setting | Why |
| --- | --- |
| `GIT_OPTIONAL_LOCKS=0` | Reading never takes git's index lock from an agent that is committing |
| `GIT_PAGER=cat`, `--no-pager` | Output comes back whole, never through a pager |
| `LC_ALL=C` | Messages are in English, so the plugin can recognise them |
| `core.quotepath=off` | Paths with non-ASCII characters come back as they are |

Output is read NUL-separated (`-z`) wherever git offers it, so paths with
spaces, quotes or line breaks come through as they are. Diffs run with
`--no-ext-diff` and `--no-color`, so no external diff tool or colour setting
of yours is used. A command that takes longer than 20 seconds is stopped.

## <picture><img src="../assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> Every command

| Command | For |
| --- | --- |
| `rev-parse --show-toplevel` | Finding the repository |
| `worktree list --porcelain -z` | The worktree list |
| `branch --show-current` | The current branch, to tell whether it is the default one |
| `symbolic-ref --quiet --short refs/remotes/origin/HEAD` | The default branch, from `origin/HEAD` |
| `rev-parse --verify --quiet <ref>` | Without `origin/HEAD`: whether `main`, `master`, `origin/main` or `origin/master` exists |
| `rev-list --count <default>..HEAD` | How many commits are not in the default branch |
| `for-each-ref --format=%(refname:short)%09%(ahead-behind:HEAD) refs/heads` | How far each local branch is, to find the base branch (git 2.41 or later) |
| `log -z --max-count=100 --format=… HEAD` or `<ref>..HEAD` | The commit list, for the chosen range |
| `diff-tree -r -M -z --no-ext-diff --name-status` and `--numstat` | A commit's changed files and their line counts |
| `diff-tree -p -M --no-color --no-ext-diff --unified=…` | The diff of one file |
| `cat-file -s` and `cat-file blob` | A file's size, then the file after or before the commit |
| `hash-object -t tree /dev/null` | The empty tree, which a root commit is compared with |

None of them changes the repository: nothing is committed, checked out,
fetched, merged, stashed or written.

To see them as they run, open the pane's debug section with `x`: it lists
the last git commands with their exit code and time. See
[Troubleshooting](TROUBLESHOOTING.md#-the-debug-section).

## <picture><img src="../assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> Where they are in the code

- [`hooks/git.ts`](../hooks/git.ts) builds every command and reads its
  output. It makes no other calls, so it can be read on its own.
- [`hooks/register.tsx`](../hooks/register.tsx), in `repoFor`, runs them
  with the options and environment above.

## <picture><img src="../assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> Git hooks

Git runs hooks around commands that change a repository: committing,
merging, checking out, rebasing, pushing and the like. None of the commands
above are among them, so Commit Walk never sets off a hook in your
repository.

To see which hooks a repository has, run this inside it:

```
git rev-parse --git-path hooks
```

It prints the folder git takes hooks from, including one set elsewhere with
`core.hooksPath`. To see where such a setting comes from:

```
git config --show-origin --get core.hooksPath
```

A hook is an executable file in that folder named after its event, such as
`pre-commit`. Files ending in `.sample` are git's examples and never run.
