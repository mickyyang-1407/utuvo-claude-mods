# utuvo-loudness

Loudness card / 響度卡 — when ffmpeg measures loudness (ebur128 or loudnorm), draws Integrated, True Peak and LRA under the tool row and checks them against Atmos Music, Apple Music, Spotify/YouTube and EBU R128 targets.

Part of [UTUVO Claude Code Mods](../README.md) · [繁體中文說明](../README.zh-Hant.md)

## Install

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-loudness@utuvo-claude-mods
```

The interface follows your system language (English or Traditional Chinese); set the `language` option to `en` or `zh-TW` to fix it. 介面跟隨系統語言（英文或繁體中文），也可以把 `language` 選項設成 `en` 或 `zh-TW` 固定下來。

## Test

```bash
claude plugin test utuvo-loudness
```

MIT © UTUVO
