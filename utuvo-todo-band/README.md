# utuvo-todo-band

To-do band / 待辦條 — a line above the prompt with how many `- [ ]` items are still open in your TODO.md and the first one; a pane lists them all by section. Reads TODO.md in the project folder, else ~/TODO.md, or the file you set. Read-only. /todo-band off | on | list.

Part of [UTUVO Claude Code Mods](../README.md) · [繁體中文說明](../README.zh-Hant.md)

## Install

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-todo-band@utuvo-claude-mods
```

The interface follows your system language (English or Traditional Chinese); set the `language` option to `en` or `zh-TW` to fix it. 介面跟隨系統語言（英文或繁體中文），也可以把 `language` 選項設成 `en` 或 `zh-TW` 固定下來。

## Test

```bash
claude plugin test utuvo-todo-band
```

MIT © UTUVO
