# utuvo-guard

Guard / 防呆閘 — checks every Bash command before it runs and stops the ones people fear an AI agent doing: rm -rf on your home or Documents, a force push to main, git reset --hard over uncommitted work, committing .env or private keys, DROP TABLE / DELETE without WHERE, erasing a disk. Protects folders you list (photos, thesis, masters) from being deleted, moved, overwritten or converted in place. Add `# guard-ok: <reason>` to override; everything is logged to ~/.local/log/utuvo-guard.log.

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
