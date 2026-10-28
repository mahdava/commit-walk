<p align="center"><img src="assets/commit-walk-logo-outlined.svg" alt="Commit Walk" width="480"></p>

## <picture><img src="assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> What is Commit Walk?

Commit Walk is a Claude Code mod, a plugin that runs inside Claude Code and
draws its own pane, for walking a Git repository worktree by worktree and
commit by commit. Pick a worktree, a commit and one of its changed files,
then read the file as a diff, or as the whole file after or before the
commit.

It is built for watching an agent's work as it lands. The pane follows new
commits while Claude edits, shows what is not committed yet, staged and
unstaged, one step after the newest commit, and it can step back through
history without leaving the session.

Everything comes from git and is only read. The plugin gives the model no
tool, writes nothing to the repository and makes no network requests.

<p align="center"><img src="assets/commit-walk-demo.gif" alt="Commit Walk in a Claude Code session: the pane opens on a feature branch, steps through files and older commits, switches between file diff, after and before, then a yellow pointer unfolds the commit list, picks a commit and switches the range to all commits, and h switches it back; last, it picks the uncommitted changes from the top of the commit list, scrolls through a file's staged and unstaged parts and steps through the files not committed yet; each pressed key shows as a keycap in the keyboard picture's colours" width="900"></p>

<p align="center"><sub>A walk through a demo branch, recorded in a real session. The yellow pointer shows what is clicked, and the keycaps what is pressed, in the colours of the keyboard below (<a href="assets/commit-walk-demo.mp4">MP4</a>).</sub></p>

## <picture><img src="assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> How to install

```
/plugin install commit-walk --marketplace mahdava/commit-walk
```

Answer `y` when it asks to add the marketplace. There is no need to clone
this repository: the command fetches Commit Walk from GitHub into Claude
Code's own plugins folder. Cloning is only for working on the plugin itself,
as [docs/DEVELOP.md](docs/DEVELOP.md) describes.

You need Claude Code 2.1.292 or later, which runs mods, and Git 2.36 or
later. Commit Walk works in Claude Code in the terminal, the desktop app, VS
Code and the mobile app. Installing from a shell or the desktop app, and
removing it, are in [docs/INSTALL.md](docs/INSTALL.md).

## <picture><img src="assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> How to update

From a shell:

```
claude plugin marketplace update commit-walk
claude plugin update commit-walk@commit-walk
```

Then run `/reload-plugins` in any open session, or start a new one.

## <picture><img src="assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> How to use Commit Walk

Run `/commit-walk` in a Claude Code session started inside a Git repository.
It opens the pane, or closes it when it is open. The pane takes the keyboard
when it opens; later, click it, or press `ctrl+x` then `Tab`, to give the
keyboard back to it.

Every row and button can also be clicked: a list unfolds when you click its
row, and folds again when you pick an entry.

<p align="center"><img src="assets/keyboard.svg" alt="The keys the pane uses, on a keyboard: o older commit, n newer commit, h commit range, f branch start, j next file, k previous file, d file diff, a file after, b file before, r refresh, x debug, Esc close, Tab next control, Enter press, arrows scroll" width="760"></p>

<details>
<summary>Keys as a table</summary>

| Key | Action |
| --- | --- |
| `o` / `n` | Older commit / newer commit |
| `h` | Commit range: all, not in main, since the base branch, in turn |
| `f` | First commit not in main: where the branch starts |
| `j` / `k` | Next file / previous file |
| `d` / `a` / `b` | File diff / file after / file before |
| `r` | Refresh |
| `x` | Debug: shows or hides the debug section |
| `Esc` | Close the pane |
| `Tab` | Next control |
| `Enter` | Press the focused row or button |
| Arrows | Scroll the pane |

</details>

## <picture><img src="assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> Resources

- [Guide](docs/GUIDE.md): the commands, what the pane shows, how it follows new commits, and its limits
- [Install](docs/INSTALL.md): requirements, installing from a shell or the desktop app, updating and removing
- [Git commands](docs/GIT.md): every git command it runs, where they are in the code, and how to check your repository's git hooks
- [Troubleshooting](docs/TROUBLESHOOTING.md): the debug section, and fixes for common problems
- [Develop](docs/DEVELOP.md): the files, the checks and working on a local copy

Found a problem, or have an idea? [Open an issue](https://github.com/mahdava/commit-walk/issues).

## <picture><img src="assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> Credits

- The logo's lettering is from the [SuperTrend](https://nhfonts.gumroad.com/l/super-trend-font) font by [NHFonts](https://nhfonts.gumroad.com/).
- ASCII art was generated by running the logo in [asciiart.eu's Image to ASCII](https://www.asciiart.eu/image-to-ascii) and modifying it personally.
- The 🌻 before each heading is the sunflower from [Noto Emoji](https://github.com/googlefonts/noto-emoji), under the Apache License 2.0.

## <picture><img src="assets/sunflower-emoji.svg" alt="" width="24" height="24" align="top"></picture> License

The code and documentation are under the [MIT License](LICENSE). The logos,
the keyboard picture and the sunflower drawings are © Lucia Nazzaro, all
rights reserved; [ARTWORK-LICENSE.md](ARTWORK-LICENSE.md) says what that
covers and allows. Third-party work keeps its own licence, as
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) lists.
