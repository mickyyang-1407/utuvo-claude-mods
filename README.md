# UTUVO Claude Code Mods

[繁體中文](README.zh-Hant.md)

Eight small [Claude Code mods](https://code.claude.com/docs/en/plugins/mods/overview) from UTUVO, a studio that makes audio tools. We use them every day. Every mod speaks English and Traditional Chinese, and each one installs on its own.

| Mod | What it does | Command |
| --- | --- | --- |
| **utuvo-session-board** | A band above the prompt listing the sessions running right now on this Mac and how long each has run; over 3 hours is flagged as possibly stuck. | `/session-board off · on` |
| **utuvo-session-colors** | Start a session title with a color block (🟥🟧🟨🟩🟦🟪🟫⬛⬜🔳🟢🔷🔶🔹🏢🪐) and the desktop app takes that color, over a night-sky backdrop. A 🔥 in the title adds a slowly breathing glow. | `/session-colors off · on` |
| **utuvo-catalog** | A pane listing the tokens each MCP server, skill, memory file and agent adds to your context, how often each was used, and what went unused for 14 days. | `/catalog` |
| **utuvo-chime** | One soft chime when a long turn finishes, another when Claude is waiting for your answer. | `/chime off · on · test` |
| **utuvo-guard** | Checks every Bash command before it runs and stops the ones you'd fear an agent running: `rm -rf ~`, a force push to main, `git reset --hard` over uncommitted work, committing `.env` or private keys, `DROP TABLE`, erasing a disk. Protects folders you list from being deleted, moved or overwritten. | — |
| **utuvo-quiet-tools** | Hides finished tool rows (Ran, Read, Edited…) in the desktop and mobile apps so the conversation reads like a chat. Running steps show one dim line; errors stay. | `/quiet-tools off · on` |
| **utuvo-todo-band** | A line above the prompt with how many `- [ ]` items are open in your `TODO.md`, and a pane listing them by section. | `/todo-band off · on · list` |
| **utuvo-loudness** | For audio people: when ffmpeg measures loudness (`ebur128` or `loudnorm`), a card under the tool row shows Integrated, True Peak and LRA against Atmos Music (−18), Apple Music (−16), Spotify / YouTube (−14) and EBU R128 (−23). | — |

## Install

Requires Claude Code 2.1.287 or later. In a Claude Code session:

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-session-board@utuvo-claude-mods
```

Swap `utuvo-session-board` for any mod in the table. From a shell:

```bash
claude plugin marketplace add mickyyang-1407/utuvo-claude-mods
claude plugin install utuvo-guard@utuvo-claude-mods
```

New sessions pick the mod up. Mods draw in the terminal, the desktop app and the VS Code extension; cloud sessions run their hooks but show nothing.

Want chat bubbles like our screenshots? That part is [prismantis](https://github.com/NahumLitvin/prismantis) by Nahum Litvin (MIT, `promptStyle: bubble`); it pairs well with utuvo-session-colors and utuvo-quiet-tools.

## Language

Every mod has a `language` option: `auto` (default) follows `LC_ALL` / `LC_MESSAGES` / `LANG`, `zh-TW` forces Traditional Chinese, `en` forces English.

```bash
echo '{"language":"zh-TW"}' | claude plugin configure utuvo-catalog@utuvo-claude-mods --values-stdin
```

## Notes per mod

**utuvo-guard**
- Everyday rules:
  - `rm` aimed at `/`, `~`, `$HOME`, a system folder, or a whole folder like Documents, Desktop or Downloads
  - force push (`--force`, `-f`, `+branch`) to main, master, production, release or trunk; `--force-with-lease` to your own branch is fine
  - `git reset --hard`, `git clean -f` (not `-n`), `git checkout -- .`, `git restore .`
  - `git add` of `.env` files (not `.env.example`), private keys, `.pem` / `.p12` / `.key`, `credentials.json`
  - `DROP TABLE` / `DATABASE` / `SCHEMA`, `TRUNCATE`, or `DELETE FROM` with no `WHERE`, sent through psql, mysql, sqlite3, wrangler d1 and similar clients
  - `diskutil eraseDisk` and friends, `mkfs`, `dd of=/dev/disk…`
- Developer rules from our own mistakes: `wrangler r2 object put/get/delete` without `--remote`; `npm uninstall -g` without `--prefix`; `pkill -f rsync`; a `pgrep -f` wait loop that matches itself; an AppleScript `content` search over Mail.
- Protected folders: list them in the `protectedFolders` option (comma-separated) or in `~/.config/utuvo-guard/protected.txt` (one per line, `#` for comments). Files under them may be read and copied out; deleting, moving, writing into and converting in place are blocked, from Bash and from edit tools. Audio files in a folder called `master` / `masters` / 母帶 are always protected.
- Override a Bash block by ending the command with `# guard-ok: <reason>`. Edit tools have no override.
- Every block, override and internal error is logged to `~/.local/log/utuvo-guard.log`. If the guard itself fails, it lets the command through (and logs it), so it never locks the machine.

**utuvo-quiet-tools**
- Desktop and mobile apps only; the terminal and VS Code keep their own look.
- Anything that errored, was interrupted or that you expanded is drawn as usual.

**utuvo-todo-band**
- Reads `TODO.md` in the session's folder, else `~/TODO.md`, or the path in the `file` option. Read-only.
- Counts open `- [ ]` items (nested too, not inside code blocks). A `**bold**` part becomes the title; a leading `YYYY-MM-DD` is shown as its date; `##` headings group the pane.

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

`utuvo-guard`, `utuvo-loudness`, `utuvo-catalog` and `utuvo-todo-band` also have plain Node tests for their pure logic, e.g. `node --experimental-strip-types --import ./tests/ts-resolve.mjs tests/general.test.mjs` inside `utuvo-guard`.

## License

MIT © UTUVO
