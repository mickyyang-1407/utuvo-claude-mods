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

export const RULES: Rule[] = [
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
