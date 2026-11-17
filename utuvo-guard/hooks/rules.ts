// Guard rules / 防呆閘規則: each one is a mistake an agent really made before.
// 純函式、不碰 $，所以能用 node 直接測（tests/rules.test.mjs）。
// 原則：只擋「確定是壞的」指令；判斷不了就放行（每次工具呼叫前都會跑，誤擋會卡死整台機器）。
// 逃生口：指令裡寫 `# guard-ok` 就放行（會記一筆 audit）。

import { checkMasterFile, checkMasterSegment } from './masters.js'
import type { Ctx, Msg } from './masters.js'

export type Rule = { id: string; why: Msg; test: (seg: string, whole: string) => boolean }

// 依未被引號包住的 ; && || | 換行 切段；引號裡的內容保留原樣。
export function segments(cmd: string): string[] {
  const out: string[] = []
  let cur = ''
  let q: string | null = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i] as string
    if (q !== null) {
      cur += c
      if (c === '\\' && q === '"' && i + 1 < cmd.length) {
        cur += cmd[++i]
      } else if (c === q) {
        q = null
      }
      continue
    }
    if (c === '"' || c === "'") {
      q = c
      cur += c
      continue
    }
    if (c === ';' || c === '\n' || c === '|' || c === '&') {
      if (cur.trim() !== '') out.push(cur.trim())
      cur = ''
      // && || 吃掉第二個字元
      if ((c === '|' || c === '&') && cmd[i + 1] === c) i++
      continue
    }
    cur += c
  }
  if (cur.trim() !== '') out.push(cur.trim())
  return out
}

// 段首可以有的前綴：環境變數、rtk、sudo、time、perl alarm 包裝…
const LEAD = String.raw`^(?:(?:[A-Za-z_][A-Za-z0-9_]*=\S*|rtk|sudo|time|command|exec|nohup|!|perl\s+-e\s+'[^']*'|perl\s+-e\s+"[^"]*")\s+)*`
const at = (body: string): RegExp => new RegExp(LEAD + body)

// 把一段拆成「不含前綴」的字詞（粗略，夠判斷旗標用）
function words(seg: string): string[] {
  return seg.split(/\s+/).filter(w => w !== '')
}

// 一般人最怕 AI 做的事（通用規則）。只擋明確的目標，判斷不了就放行。
const DANGER_RM = /^(?:\/|\/\*|~|~\/|~\/\*|\$HOME|\$HOME\/|\$HOME\/\*|\$\{HOME\}|\$\{HOME\}\/|\/Users|\/home|\/System|\/Library|\/Applications|\/usr|\/etc|\/var|\/bin|\/opt|\/private|(?:~|\$HOME|\$\{HOME\})\/(?:Documents|Desktop|Downloads|Library|Pictures|Music|Movies|Projects|Dropbox|iCloud Drive|Library\/Mobile Documents))\/?$/
const PROTECTED_BRANCH = /^\+?(?:(?:HEAD|[^:\s]*):)?(?:refs\/heads\/)?(main|master|production|prod|release|trunk)$/
const SECRET_FILE = /(?:^|\/)(?:\.env(?:\.(?!example$|sample$|template$|dist$|defaults?$)[\w.-]+)?|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|p12|pfx|key|keystore|jks|mobileprovision|p8)|credentials\.json|service-account[^/]*\.json|\.npmrc|\.pypirc|\.netrc)$/
const DB_CLIENT = at(String.raw`(?:npx\s+)?(?:psql|mysql|mariadb|sqlite3|duckdb|sqlcmd|mongosh|clickhouse-client|cockroach\s+sql|supabase\s+db|wrangler\s+d1\s+execute|turso\s+db\s+shell|prisma\s+db\s+execute)\b`)

export const GENERAL_RULES: Rule[] = [
  {
    id: 'rm-everything',
    why: {
      zh: '這條 `rm` 會刪掉整個家目錄、系統資料夾或文件／桌面這種大資料夾，刪了救不回來。請指定要刪的那個子資料夾。',
      en: 'This `rm` would delete your whole home folder, a system folder or a folder like Documents or Desktop; there is no undo. Name the exact subfolder instead.',
    },
    test: seg => {
      if (!at(String.raw`rm\s`).test(seg)) return false
      return words(seg).slice(1).some(w => !w.startsWith('-') && DANGER_RM.test(w.replace(/^["']|["']$/g, '')))
    },
  },
  {
    id: 'git-force-push-main',
    why: {
      zh: '強制推送（`--force`）到 main／master 這類主分支，會把別人或線上的紀錄蓋掉。改推到新分支、開 PR；真的要改寫歷史，先跟負責的人確認。',
      en: 'A force push to main, master or another release branch overwrites history others depend on. Push a new branch and open a PR; rewrite history only after checking with whoever owns it.',
    },
    test: seg => {
      if (!at(String.raw`git\s+(?:-C\s+\S+\s+)?push\b`).test(seg)) return false
      const w = words(seg)
      const force = w.some(x => x === '--force' || x === '-f' || /^-[a-z]*f[a-z]*$/.test(x) && !x.startsWith('--'))
      const plusRef = w.some(x => /^\+/.test(x) && PROTECTED_BRANCH.test(x))
      return (force || plusRef) && w.some(x => PROTECTED_BRANCH.test(x))
    },
  },
  {
    id: 'git-discard-changes',
    why: {
      zh: '這條 git 指令會把還沒 commit 的修改整批丟掉，救不回來。先 `git stash` 或 commit 起來，再做。',
      en: 'This git command throws away every uncommitted change, with no undo. Run `git stash` or commit first.',
    },
    test: seg => {
      const g = String.raw`git\s+(?:-C\s+\S+\s+)?`
      if (at(g + String.raw`reset\s+(?:.*\s)?--hard\b`).test(seg)) return true
      if (at(g + String.raw`clean\s+(?:\S+\s+)*-[a-zA-Z]*f`).test(seg) && !/\s(?:-[a-zA-Z]*n[a-zA-Z]*|--dry-run)(?:\s|$)/.test(seg)) return true
      if (at(g + String.raw`checkout\s+(?:--\s+)?\.\s*$`).test(seg)) return true
      if (at(g + String.raw`restore\s+(?:--worktree\s+)?\.\s*$`).test(seg)) return true
      return false
    },
  },
  {
    id: 'secret-commit',
    why: {
      zh: '要把密碼／金鑰檔（.env、私鑰、憑證）加進 git。推上 GitHub 之後就算刪掉，歷史紀錄裡還是拿得到。把它寫進 `.gitignore`，改提交 `.env.example`。',
      en: 'This adds a secrets file (.env, a private key, a certificate) to git. Once pushed it stays in history even after you delete it. Put it in `.gitignore` and commit a `.env.example` instead.',
    },
    test: seg => {
      if (!at(String.raw`git\s+(?:-C\s+\S+\s+)?add\b`).test(seg)) return false
      return words(seg).slice(2).some(w => !w.startsWith('-') && SECRET_FILE.test(w.replace(/^["']|["']$/g, '')))
    },
  },
  {
    id: 'sql-destroy',
    why: {
      zh: '這條資料庫指令會刪掉整張表或整個資料庫（DROP／TRUNCATE，或沒有 WHERE 的 DELETE）。先備份，或在測試資料庫上跑。',
      en: 'This database command drops or empties a whole table or database (DROP, TRUNCATE, or DELETE without WHERE). Back up first, or run it on a test database.',
    },
    test: (seg, whole) => {
      if (!DB_CLIENT.test(seg)) return false
      if (/\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA|COLLECTION)|TRUNCATE\s+(?:TABLE\s+)?\w|dropDatabase\s*\()/i.test(whole)) return true
      return /\bDELETE\s+FROM\s+[\w."`\[\]]+\s*(?:;|$|["'])/im.test(whole)
    },
  },
  {
    id: 'disk-erase',
    why: {
      zh: '這條指令會清除或格式化整顆磁碟。請自己在「磁碟工具程式」確認是哪一顆再做。',
      en: 'This command erases or formats a whole disk. Do it yourself in Disk Utility after checking which disk it is.',
    },
    test: seg =>
      at(String.raw`diskutil\s+(?:eraseDisk|eraseVolume|zeroDisk|randomDisk|secureErase|partitionDisk|reformat|apfs\s+deleteContainer)\b`).test(seg) ||
      at(String.raw`mkfs(?:\.\w+)?\s`).test(seg) ||
      (at(String.raw`dd\s`).test(seg) && /\bof=\/dev\/(?:r?disk|sd|nvme|hd)/.test(seg)),
  },
]

// UTUVO 自己踩過的坑（開發工具），保留給用得到的人。
export const DEV_RULES: Rule[] = [
  {
    id: 'wrangler-r2-remote',
    why: {
      zh: '`wrangler r2 object put/get/delete` 沒帶 `--remote` 會打到本機的假桶（Resource location: local）。加上 `--remote` 再跑。',
      en: '`wrangler r2 object put/get/delete` without `--remote` hits a local stand-in bucket (Resource location: local). Add `--remote`.',
    },
    test: seg => at(String.raw`(?:npx\s+)?wrangler\s+r2\s+object\s+(?:put|get|delete)\b`).test(seg) && !/\s--remote\b/.test(seg),
  },
  {
    id: 'npm-uninstall-g-prefix',
    why: {
      zh: '`npm uninstall -g` 沒指定 `--prefix`：機器上有好幾份 npm 時可能刪錯那份。先 `npm prefix -g` 確認，再帶 `--prefix <要刪的那份的目錄>`。',
      en: '`npm uninstall -g` without `--prefix`: with several npm installs you may remove the wrong copy. Check `npm prefix -g`, then pass `--prefix <that folder>`.',
    },
    test: seg => {
      if (!at(String.raw`npm\s`).test(seg)) return false
      const w = words(seg)
      const verb = w.some(x => ['uninstall', 'un', 'remove', 'rm', 'r', 'unlink'].includes(x))
      const global = w.some(x => x === '-g' || x === '--global' || x === '--location=global')
      return verb && global && !w.some(x => x === '--prefix' || x.startsWith('--prefix='))
    },
  },
  {
    id: 'pkill-rsync',
    why: {
      zh: '`pkill -f rsync` 會誤殺 macOS 的 colorsync 服務。pattern 要帶路徑片段（例如 `pkill -f "rsync .*Backup"`）。',
      en: '`pkill -f rsync` also kills macOS colorsync services. Add part of the path to the pattern (e.g. `pkill -f "rsync .*Backup"`).',
    },
    test: seg => at(String.raw`pkill\s+(?:-\S+\s+)*?-[A-Za-z]*f[A-Za-z]*\s+(?:-\S+\s+)*['"]?rsync['"]?\s*$`).test(seg),
  },
  {
    id: 'pgrep-wait-self-match',
    why: {
      zh: '等待迴圈裡的 `pgrep -f` 會比對到等待者自己的指令列，永遠等不完。改用背景任務（跑完會通知），或寫成 `pgrep -f "[x]codebuild"` 這種不會比對到自己的寫法。',
      en: '`pgrep -f` inside a wait loop matches the waiting command itself and never finishes. Use a background task, or a self-excluding pattern like `pgrep -f "[x]codebuild"`.',
    },
    test: seg => {
      if (!at(String.raw`(?:until|while)\s`).test(seg)) return false
      const m = /\bpgrep\s+(?:-\S+\s+)*?-[A-Za-z]*f[A-Za-z]*\s+(?:-\S+\s+)*(['"]?)(\S+?)\1(?:\s|$)/.exec(seg)
      return m !== null && !(m[2] ?? '').includes('[')
    },
  },
  {
    id: 'mail-applescript-content',
    why: {
      zh: '不要對 Mail 下 `content` 全文搜尋的 AppleScript（會把 Mail 卡死）。先用 `mdfind` 找信，再只讀那幾封。',
      en: 'An AppleScript `content` search over Mail freezes Mail. Find the messages with `mdfind` first, then read only those.',
    },
    test: (seg, whole) =>
      at(String.raw`osascript\b`).test(seg) &&
      /application\s+\\?["']Mail\\?["']/i.test(whole) &&
      /\bcontent\b/i.test(whole),
  },
]

export const RULES: Rule[] = [...GENERAL_RULES, ...DEV_RULES]

export type Verdict = { allow: true; override?: string } | { allow: false; rule: string; why: Msg }

export function check(cmd: string): Verdict {
  const segs = segments(cmd)
  for (const r of RULES) {
    if (segs.some(s => r.test(s, cmd))) {
      if (/#\s*guard-ok\b/.test(cmd)) return { allow: true, override: r.id }
      return { allow: false, rule: r.id, why: r.why }
    }
  }
  return { allow: true }
}

// 母帶保護（hooks/masters.ts）：先跑上面的規則，再看會不會動到母帶。
// ctx 沒給（舊呼叫方式／讀不到設定）就只用「資料夾名」判斷，不用根目錄清單。
export function checkBash(cmd: string, ctx: Ctx = { home: '', roots: [] }): Verdict {
  const v = check(cmd)
  if (!v.allow || v.override !== undefined) return v
  for (const seg of segments(cmd)) {
    const hit = checkMasterSegment(seg, ctx)
    if (hit !== null) {
      if (/#\s*guard-ok\b/.test(cmd)) return { allow: true, override: hit.id }
      return { allow: false, rule: hit.id, why: hit.why }
    }
  }
  return { allow: true }
}

export function checkFileTool(filePath: string, ctx: Ctx = { home: '', roots: [] }): Verdict {
  const hit = checkMasterFile(filePath, ctx)
  return hit === null ? { allow: true } : { allow: false, rule: hit.id, why: hit.why }
}
