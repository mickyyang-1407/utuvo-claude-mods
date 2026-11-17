# UTUVO Claude Code MOD

[English](README.md)

UTUVO 是做音訊工具的工作室，這裡是我們自己每天在用的六個 [Claude Code MOD](https://code.claude.com/docs/en/plugins/mods/overview)。每個都有中英文介面，可以單獨安裝。

| MOD | 做什麼 | 指令 |
| --- | --- | --- |
| **utuvo-loudness** 響度卡 | ffmpeg 量響度（`ebur128` 或 `loudnorm`）時，在那一列下面畫一張卡：Integrated、True Peak、LRA，並對照 Atmos Music（−18）、Apple Music（−16）、Spotify／YouTube（−14）、EBU R128（−23） | — |
| **utuvo-guard** 防呆閘 | Bash 指令執行前擋下已知的 AI 常犯錯誤；保護原始母帶不被刪除、搬移、覆寫、原地轉檔 | — |
| **utuvo-catalog** 設定清單 | 列出每個 MCP、skill、記憶檔、agent 佔多少 token、用過幾次、14 天沒用的打 ⚠ | `/catalog` |
| **utuvo-chime** 提示音 | 長回合做完響一聲，Claude 在等你回答時響另一聲 | `/chime off · on · test` |
| **utuvo-session-colors** 依色塊換主題 | session 標題開頭放色塊（🟥🟧🟨🟩🟦🟪🟫⬛⬜🔳🟢🔷🔶🔹🏢🪐），桌面版就換成那個顏色，背景是星空；標題有 🔥 時光暈會慢慢呼吸 | `/session-colors off · on` |
| **utuvo-session-board** 執行中清單 | 輸入框上方列出這台 Mac 上正在跑的 session、各跑了多久，超過 3 小時標「可能卡住了」 | `/session-board off · on` |

## 安裝

需要 Claude Code 2.1.287 以上。在 Claude Code 裡輸入：

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-loudness@utuvo-claude-mods
```

把 `utuvo-loudness` 換成表格裡任一個名字即可。用終端機：

```bash
claude plugin marketplace add mickyyang-1407/utuvo-claude-mods
claude plugin install utuvo-guard@utuvo-claude-mods
```

新開的 session 就會生效。MOD 會畫在終端機、桌面版、VS Code 外掛裡；雲端 session 只跑邏輯、不顯示畫面。

## 語言

每個 MOD 都有「語言」選項：`auto`（預設）跟隨系統的 `LC_ALL`／`LC_MESSAGES`／`LANG`；`zh-TW` 固定繁體中文；`en` 固定英文。

```bash
echo '{"language":"zh-TW"}' | claude plugin configure utuvo-catalog@utuvo-claude-mods --values-stdin
```

## 各 MOD 細節

**utuvo-guard 防呆閘**
- 擋的錯誤：`wrangler r2 object put/get/delete` 沒帶 `--remote`；`npm uninstall -g` 沒帶 `--prefix`；`pkill -f rsync`（會誤殺 macOS 的 colorsync）；等待迴圈裡比對到自己的 `pgrep -f`；對 Mail 做 `content` 全文搜尋的 AppleScript
- 母帶的判斷：路徑中有資料夾叫 `master`／`masters`（不分大小寫）或名字含「母帶」，或在 `~/.config/utuvo-guard/protected-masters.txt` 列出的資料夾底下（一行一個，`#` 開頭是註解）。讀取、複製出去一律放行；刪除、搬移、寫進去、原地轉檔或改標籤會被擋
- 真的要跑，在指令最後加 `# guard-ok: <理由>`；編輯工具沒有這個逃生口
- 每次擋下、放行、出錯都記在 `~/.local/log/utuvo-guard.log`；閘門本身出錯時一律放行並記錄，不會卡住整台機器

**utuvo-catalog 設定清單**
- 讀的是 `/context` 用的同一份資料，不會送出你的電腦
- 使用次數從裝上 MOD 那天開始記；記滿 14 天後才開始標「久沒用」
- 只讀不改；要關掉什麼，直接跟 Claude 說

**utuvo-session-colors 依色塊換主題**
- 從桌面版的 session 檔讀標題，改標題後 10 秒內跟著換
- 只有深色模式；沒有色塊時是深藍星空

**utuvo-session-board 執行中清單**
- 只讀 `~/.claude/sessions/<數字>.json`，旁邊的金鑰檔絕不打開

## 測試

每個 MOD 都附測試：

```bash
claude plugin validate utuvo-catalog
claude plugin test utuvo-catalog
```

`utuvo-guard`、`utuvo-loudness`、`utuvo-catalog` 另有純邏輯的 Node 測試，例如在 `utuvo-guard` 裡跑 `node --experimental-strip-types --import ./tests/ts-resolve.mjs tests/rules.test.mjs`。

## 授權

MIT © UTUVO
