# utuvo-guard

Guard / 防呆閘 — stops known agent mistakes before a Bash command runs (wrangler r2 without --remote, npm uninstall -g without --prefix, pkill -f rsync, self-matching pgrep waits, AppleScript content search in Mail) and protects original audio masters from being deleted, moved, overwritten or converted in place. Add `# guard-ok: <reason>` to override; everything is logged to ~/.local/log/utuvo-guard.log.

Part of [UTUVO Claude Code Mods](../README.md) · [繁體中文說明](../README.zh-Hant.md)

## Install

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-guard@utuvo-claude-mods
```

The interface follows your system language (English or Traditional Chinese); set the `language` option to `en` or `zh-TW` to fix it. 介面跟隨系統語言（英文或繁體中文），也可以把 `language` 選項設成 `en` 或 `zh-TW` 固定下來。

## Test

```bash
claude plugin test utuvo-guard
```

MIT © UTUVO
