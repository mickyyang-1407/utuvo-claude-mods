# UTUVO Claude Code MOD

[English](README.md)

UTUVO是做音訊工具的工作室，這裡是我們自己每天在用的八個[Claude Code MOD](https://code.claude.com/docs/en/plugins/mods/overview)。每個都有中英文介面，可以單獨安裝

| MOD | 做什麼 | 指令 |
| --- | --- | --- |
| **utuvo-session-board** 執行中清單 | 輸入框上方列出這台Mac上正在跑的session、各跑了多久，超過3小時標「可能卡住了」 | `/session-board off · on` |
| **utuvo-session-colors** 依色塊換主題 | session標題開頭放色塊（🟥🟧🟨🟩🟦🟪🟫⬛⬜🔳🟢🔷🔶🔹🏢🪐），桌面版就換成那個顏色，背景是星空；標題有🔥時光暈會慢慢呼吸 | `/session-colors off · on` |
| **utuvo-catalog** 設定清單 | 列出每個MCP、skill、記憶檔、agent佔多少token、用過幾次、14天沒用的打⚠ | `/catalog` |
| **utuvo-chime** 提示音 | 長回合做完響一聲，Claude在等你回答時響另一聲 | `/chime off · on · test` |
| **utuvo-guard** 防呆閘 | Bash指令執行前先檢查，擋下最怕AI做的事：`rm -rf ~`、強制推送到main、`git reset --hard`丟掉沒存的修改、把`.env`或私鑰加進git、`DROP TABLE`、清除磁碟；你列的資料夾不被刪、搬、覆寫 | — |
| **utuvo-quiet-tools** 收起工具列 | 桌面版和手機版把做完的工具列（Ran、Read、Edited…）收起來，對話看起來像聊天；執行中只留一行淡字，出錯照常顯示 | `/quiet-tools off · on` |
| **utuvo-todo-band** 待辦條 | 輸入框上方一行顯示`TODO.md`裡還有幾件`- [ ]`沒做、下一件是什麼，面板依段落列出全部 | `/todo-band off · on · list` |
| **utuvo-loudness** 響度卡 | 給做音樂的人：ffmpeg量響度（`ebur128`或`loudnorm`）時，在那一列下面畫一張卡，Integrated、True Peak、LRA對照Atmos Music（−18）、Apple Music（−16）、Spotify／YouTube（−14）、EBU R128（−23） | — |

## 安裝

需要Claude Code 2.1.287以上。在Claude Code裡輸入：

```
/plugin marketplace add mickyyang-1407/utuvo-claude-mods
/plugin install utuvo-session-board@utuvo-claude-mods
```

把`utuvo-session-board`換成表格裡任一個名字即可。用終端機：

```bash
claude plugin marketplace add mickyyang-1407/utuvo-claude-mods
claude plugin install utuvo-guard@utuvo-claude-mods
```

新開的session就會生效。MOD會畫在終端機、桌面版、VS Code外掛裡；雲端session只跑邏輯、不顯示畫面

想要跟我們截圖一樣的聊天泡泡？那是Nahum Litvin做的[prismantis](https://github.com/NahumLitvin/prismantis)（MIT授權，設定`promptStyle: bubble`），跟utuvo-session-colors、utuvo-quiet-tools很搭

## 語言

每個MOD都有「語言」選項：`auto`（預設）跟隨系統的`LC_ALL`／`LC_MESSAGES`／`LANG`；`zh-TW`固定繁體中文；`en`固定英文

```bash
echo '{"language":"zh-TW"}' | claude plugin configure utuvo-catalog@utuvo-claude-mods --values-stdin
```

## 各MOD細節

**utuvo-guard 防呆閘**
- 一般規則：
  - `rm`指向`/`、`~`、`$HOME`、系統資料夾，或文件、桌面、下載這種整個資料夾
  - 強制推送（`--force`、`-f`、`+分支`）到main、master、production、release、trunk；推自己的分支或用`--force-with-lease`照常
  - `git reset --hard`、`git clean -f`（`-n`試跑照常）、`git checkout -- .`、`git restore .`
  - `git add`密碼檔：`.env`（`.env.example`照常）、私鑰、`.pem`／`.p12`／`.key`、`credentials.json`
  - 經psql、mysql、sqlite3、wrangler d1這類工具送出的`DROP TABLE`／`DATABASE`／`SCHEMA`、`TRUNCATE`、沒有`WHERE`的`DELETE FROM`
  - `diskutil eraseDisk`這類清除磁碟指令、`mkfs`、`dd of=/dev/disk…`
- 開發者規則（我們自己踩過的坑）：`wrangler r2 object put/get/delete`沒帶`--remote`；`npm uninstall -g`沒帶`--prefix`；`pkill -f rsync`；等待迴圈裡比對到自己的`pgrep -f`；對Mail做`content`全文搜尋的AppleScript
- 受保護的資料夾：寫在選項`protectedFolders`（逗號分隔），或`~/.config/utuvo-guard/protected.txt`（一行一個，`#`開頭是註解）。裡面的檔案可以讀、可以複製出去；刪除、搬移、寫進去、原地轉檔會被擋，Bash和編輯工具都一樣。資料夾叫`master`／`masters`／母帶的，裡面的音檔一律保護
- 真的要跑，在指令最後加`# guard-ok: <理由>`；編輯工具沒有這個逃生口
- 每次擋下、放行、出錯都記在`~/.local/log/utuvo-guard.log`；閘門本身出錯時一律放行並記錄，不會卡住整台機器

**utuvo-quiet-tools 收起工具列**
- 只作用在桌面版和手機版；終端機、VS Code維持原樣
- 出錯、被中斷、你點開的工具列照常顯示

**utuvo-todo-band 待辦條**
- 讀session所在資料夾的`TODO.md`，沒有就讀`~/TODO.md`，也可以在選項`file`指定路徑；只讀不改
- 算沒打勾的`- [ ]`（縮排的也算，程式碼區塊裡的不算）；有`**粗體**`就當標題，開頭的`YYYY-MM-DD`當日期，面板依`##`標題分段

**utuvo-catalog 設定清單**
- 讀的是`/context`用的同一份資料，不會送出你的電腦
- 使用次數從裝上MOD那天開始記；記滿14天後才開始標「久沒用」
- 只讀不改；要關掉什麼，直接跟Claude說

**utuvo-session-colors 依色塊換主題**
- 從桌面版的session檔讀標題，改標題後10秒內跟著換
- 只有深色模式；沒有色塊時是深藍星空

**utuvo-session-board 執行中清單**
- 只讀`~/.claude/sessions/<數字>.json`，旁邊的金鑰檔絕不打開

## 測試

每個MOD都附測試：

```bash
claude plugin validate utuvo-catalog
claude plugin test utuvo-catalog
```

`utuvo-guard`、`utuvo-loudness`、`utuvo-catalog`、`utuvo-todo-band`另有純邏輯的Node測試，例如在`utuvo-guard`裡跑`node --experimental-strip-types --import ./tests/ts-resolve.mjs tests/general.test.mjs`

## 授權

MIT © UTUVO
