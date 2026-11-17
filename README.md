# UTUVO Claude Code Mods

[繁體中文](README.zh-Hant.md)

Six small [Claude Code mods](https://code.claude.com/docs/en/plugins/mods/overview) from UTUVO, a studio that makes audio tools. Every mod speaks English and Traditional Chinese, and each one installs on its own.

| Mod | What it does | Command |
| --- | --- | --- |
| **utuvo-loudness** | When ffmpeg measures loudness (`ebur128` or `loudnorm`), a card under the tool row shows Integrated, True Peak and LRA, and checks them against Atmos Music (−18), Apple Music (−16), Spotify / YouTube (−14) and EBU R128 (−23). | — |
| **utuvo-guard** | Stops known agent mistakes before a Bash command runs, and protects original audio masters from being deleted, moved, overwritten or converted in place. | — |
| **utuvo-catalog** | A pane listing the tokens each MCP server, skill, memory file and agent adds to your context, how often each was used, and what went unused for 14 days. | `/catalog` |
| **utuvo-chime** | One soft chime when a long turn finishes, another when Claude is waiting for your answer. | `/chime off · on · test` |
| **utuvo-session-colors** | Start a session title with a color block (🟥🟧🟨🟩🟦🟪🟫⬛⬜🔳🟢🔷🔶🔹🏢🪐) and the desktop app takes that color, over a night-sky backdrop. A 🔥 in the title adds a slowly breathing glow. | `/session-colors off · on` |
| **utuvo-session-board** | A band above the prompt listing the sessions running right now on this Mac and how long each has run; over 3 hours is flagged as possibly stuck. | `/session-board off · on` |

## Install

Requires Claude Code 2.1.287 or later. In a Claude Code session:

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-loudness@utuvo-claude-mods
```

Swap `utuvo-loudness` for any mod in the table. From a shell:

```bash
claude plugin marketplace add mickyyang-1407/utuvo-claude-mods
claude plugin install utuvo-guard@utuvo-claude-mods
```

New sessions pick the mod up. Mods draw in the terminal, the desktop app and the VS Code extension; cloud sessions run their hooks but show nothing.

## Language

Every mod has a `language` option: `auto` (default) follows `LC_ALL` / `LC_MESSAGES` / `LANG`, `zh-TW` forces Traditional Chinese, `en` forces English.

```bash
echo '{"language":"zh-TW"}' | claude plugin configure utuvo-catalog@utuvo-claude-mods --values-stdin
```

## Notes per mod

**utuvo-guard**
- Rules: `wrangler r2 object put/get/delete` without `--remote`; `npm uninstall -g` without `--prefix`; `pkill -f rsync` (it also kills macOS colorsync services); `pgrep -f` in a wait loop that matches itself; an AppleScript `content` search over Mail.
- Masters: an audio file is a master when a folder on its path is called `master` / `masters` (any case) or contains 母帶, or when it sits under a folder listed in `~/.config/utuvo-guard/protected-masters.txt` (one path per line, `#` for comments). Reading and copying out are always allowed; deleting, moving, writing into, and converting or re-tagging in place are blocked.
- Override a Bash block by ending the command with `# guard-ok: <reason>`. Edit tools have no override.
- Every block, override and internal error is logged to `~/.local/log/utuvo-guard.log`. If the guard itself fails, it lets the command through (and logs it), so it never locks the machine.

**utuvo-catalog**
- Reads the same breakdown `/context` uses; nothing leaves your machine.
- Usage is counted from the day you install the mod, in the mod's own store. "Unused" marks start once it has counted for 14 days.
- Read-only. To turn something off, ask Claude.

**utuvo-session-colors**
- Reads the session title from the desktop app's session file, so titles you rename take effect within 10 seconds.
- Dark mode only. With no color block the backdrop is the deep-blue night sky.

**utuvo-session-board**
- Reads only `~/.claude/sessions/<digits>.json` (never the key files next to them).

## Tests

Each mod carries its own tests:

```bash
claude plugin validate utuvo-catalog
claude plugin test utuvo-catalog
```

`utuvo-guard`, `utuvo-loudness` and `utuvo-catalog` also have plain Node tests for their pure logic, e.g. `node --experimental-strip-types --import ./tests/ts-resolve.mjs tests/rules.test.mjs` inside `utuvo-guard`.

## License

MIT © UTUVO
