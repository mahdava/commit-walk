# Installing Commit Walk

## Requirements

| What | Version |
| --- | --- |
| Claude Code | 2.1.292 or later, for the mods API. Tested on 2.1.292 and 2.1.302. |
| Git | 2.36 or later, for NUL-separated `git worktree list` output. 2.41 or later for the base-branch range |

It draws the same on the terminal, the desktop app, VS Code and the mobile
app: every control is a button.

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
