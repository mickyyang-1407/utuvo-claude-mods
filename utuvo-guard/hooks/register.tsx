import type { EngineInterface, Register } from 'claude-code'

import { checkBash, checkFileTool } from './rules.js'
import { parseRoots } from './masters.js'
import type { Ctx } from './masters.js'
import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

// Guard / 防呆閘: before a Bash command runs, check it against dangerous commands (hooks/rules.ts) and the
// protected-folder rules (hooks/masters.ts). A block tells Claude why and how to fix it; `# guard-ok: <reason>`
// lets it through (logged). If the guard itself fails it lets the command through and logs that (fail-open).

const LOG = '/.local/log/utuvo-guard.log'
// 受保護資料夾清單（每行一個，# 註解）＋選項 protectedFolders。讀不到就只靠資料夾名（master／masters／母帶）判斷。
const ROOT_FILES = ['/.config/utuvo-guard/protected.txt', '/.config/utuvo-guard/protected-masters.txt']
let ctx: Ctx = { home: '', roots: [] }
let lang: Lang = 'en'

const TEXT = {
  zh: {
    blocked: '防呆閘（utuvo-guard）擋下：',
    escape: '真的要跑，在指令最後加上 `# guard-ok: <理由>`。',
    noEscape: '編輯工具沒有逃生口；真的要動受保護的檔案，請自己在 Finder 或終端機處理。',
    status: '🛑 防呆閘擋下：',
  },
  en: {
    blocked: 'Blocked by utuvo-guard: ',
    escape: 'If you really mean it, end the command with `# guard-ok: <reason>`.',
    noEscape: 'Edit tools have no override; if a protected file really must change, do it yourself in Finder or a terminal.',
    status: '🛑 utuvo-guard blocked: ',
  },
} as const

async function loadCtx($: EngineInterface, option: unknown): Promise<void> {
  const home = (await $.env.get('HOME')) ?? ''
  const roots: string[] = typeof option === 'string' ? parseRoots(option.replace(/,/g, '\n'), home) : []
  for (const f of ROOT_FILES) {
    try {
      if (home !== '' && (await $.fs.exists(home + f))) roots.push(...parseRoots(await $.fs.read(home + f), home))
    } catch (err) {
      await audit($, `protected list ${f} unreadable, skipped: ${String(err).slice(0, 120)}`)
    }
  }
  ctx = { home, roots }
}

const FILE_TOOLS = /^(Write|Edit|MultiEdit|NotebookEdit)$/

async function audit($: EngineInterface, line: string): Promise<void> {
  try {
    const home = (await $.env.get('HOME')) ?? ''
    if (home === '') return
    const stamp = new Date(await $.clock.now()).toISOString()
    await $.process.run(['/bin/sh', '-c', 'mkdir -p "$(dirname "$2")" && printf "%s\\n" "$1" >> "$2"', 'sh', `${stamp} ${line}`, home + LOG])
  } catch {
    // audit 本身失敗就算了，不影響指令
  }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    lang = pickLang(options?.language, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
    await loadCtx($, options?.protectedFolders)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    let verdict
    try {
      verdict = checkBash(e.command, ctx)
    } catch (err) {
      await audit($, `fail-open (guard error) ${String(err).slice(0, 120)} | ${e.command.slice(0, 200)}`)
      return next(e)
    }
    if (!verdict.allow) {
      await audit($, `blocked ${verdict.rule} | ${e.command.slice(0, 200)}`)
      $.ui.status(`${TEXT[lang].status}${verdict.rule}`)
      return { deny: `${TEXT[lang].blocked}${verdict.why[lang]}\n${TEXT[lang].escape}` }
    }
    if (verdict.override !== undefined) {
      await audit($, `allowed (guard-ok) ${verdict.override} | ${e.command.slice(0, 200)}`)
    }
    return next(e)
  }).catch(async ($, e, next) => {
    // the whole hook failed: let it through (fail-open) and log it
    await audit($, `fail-open (hook error) | ${e.command.slice(0, 200)}`)
    return next(e)
  })

  on('tool.call', { tool: FILE_TOOLS }, async ($, e, next) => {
      const input = e as unknown as { file_path?: unknown; notebook_path?: unknown }
      const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : ''
      if (path === '') return next(e)
      const verdict = checkFileTool(path, ctx)
      if (!verdict.allow) {
        await audit($, `blocked ${verdict.rule} | ${e.tool} ${path}`)
        $.ui.status(`${TEXT[lang].status}${verdict.rule}`)
        return { deny: `${TEXT[lang].blocked}${verdict.why[lang]}\n${TEXT[lang].noEscape}` }
      }
      return next(e)
    }).catch(async ($, e, next) => {
      await audit($, `fail-open (${e.tool} hook error)`)
      return next(e)
    })
}
