# Developing commit-walk

The plugin is a Claude Code mod: a hooks module that runs inside Claude
Code's own plugin environment, with no Node APIs.

| File | Holds |
| --- | --- |
| `hooks/git.ts` | The git commands and NUL-safe parsers. It makes no engine calls, so tests drive it with canned output. |
| `hooks/register.tsx` | The hooks: the command, the refresh triggers and the pane |
| `hooks/window.ts` | The window of rows a long list shows |
| `hooks/welcome.ts` | The welcome art, with a colour mask per row |
| `types/index.d.ts` | The state contract: the values kept in the session's plugin state |
| `tests/git.test.ts` | Parser and fitting tests |
| `tests/window.test.ts` | List window tests |
| `tests/pane.test.tsx` | Pane tests on the terminal, desktop and mobile surfaces |
| `.claude-plugin/plugin.json` | The manifest |
| `.claude-plugin/marketplace.json` | Makes the repository its own marketplace |
| `assets/commit-walk-logo.svg` | The logo |
| `assets/commit-walk-logo-outlined.svg` | The logo with a white outline, for dark backgrounds; the README shows it |
| `assets/logo.png` | The first logo, as a PNG |
| `assets/commit-walk-demo.gif`, `.mp4` | The demo at the top of the README |
| `assets/screenshots/` | The guide's screenshot |
| `assets/keyboard.svg` | The keys the pane uses, on a keyboard; the README shows it |
| `tools/screenshots/` | `make-media.sh` remakes the demo and screenshot from a real session in a throwaway repository; its header lists what it needs |
| `tools/art/keys.mjs` | What each key does and its colour, shared by the keyboard image and the demo's keycaps |
| `tools/art/keyboard.mjs` | Draws `assets/keyboard.svg`: `node tools/art/keyboard.mjs > assets/keyboard.svg` |
| `docs/` | The guide, install, troubleshooting and this page, linked from the README |

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
