# utuvo-catalog

Setup catalog / 設定清單 — /catalog opens a pane with the tokens each MCP server, skill, memory file and agent adds to the context, how often each was used and when last; anything unused for 14 days is marked. Read-only.

Part of [UTUVO Claude Code Mods](../README.md) · [繁體中文說明](../README.zh-Hant.md)

## Install

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-catalog@utuvo-claude-mods
```

The interface follows your system language (English or Traditional Chinese); set the `language` option to `en` or `zh-TW` to fix it. 介面跟隨系統語言（英文或繁體中文），也可以把 `language` 選項設成 `en` 或 `zh-TW` 固定下來。

## Test

```bash
claude plugin test utuvo-catalog
```

MIT © UTUVO
