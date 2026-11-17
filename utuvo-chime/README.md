# utuvo-chime

Chimes / 提示音 — one soft chime when a turn of 20 s or longer finishes, a second one when Claude waits for your answer or a permission prompt opens. /chime off | on | test.

Part of [UTUVO Claude Code Mods](../README.md) · [繁體中文說明](../README.zh-Hant.md)

## Install

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-chime@utuvo-claude-mods
```

The interface follows your system language (English or Traditional Chinese); set the `language` option to `en` or `zh-TW` to fix it. 介面跟隨系統語言（英文或繁體中文），也可以把 `language` 選項設成 `en` 或 `zh-TW` 固定下來。

## Test

```bash
claude plugin test utuvo-chime
```

MIT © UTUVO
