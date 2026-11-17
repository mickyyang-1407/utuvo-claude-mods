import type { Register } from 'claude-code'

import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

// Quiet tools / 收起工具列: in the desktop and mobile apps, a finished tool row draws nothing, a running one draws
// one dim line, and anything errored, interrupted or expanded is left to Claude Code. The terminal and VS Code
// keep their own look. /quiet-tools off turns it off for every session (stored), on turns it back on.

const ENABLED_KEY = 'enabled'
let langPref: unknown = 'auto'
let lang: Lang = 'en'

const TEXT = {
  zh: {
    describe: '收起工具列：on 收起、off 照原樣、不加參數看狀態',
    usage: '用法：/quiet-tools on 收起，/quiet-tools off 照原樣',
    on: '已開啟「收起工具列」：做完的步驟不再顯示，出錯的照常顯示。新的工具列會照新設定畫。',
    off: '已關閉「收起工具列」。之後新出現的工具列會恢復原本樣子；已經收起的，重新打開這個對話才會出現。',
    status: (on: boolean) => `「收起工具列」目前：${on ? '開啟' : '關閉'}`,
    unknown: '看不懂這個參數。',
    running: '⋯ 執行中',
    runningN: (n: number) => `⋯ 執行中（${n} 個步驟）`,
  },
  en: {
    describe: 'Quiet tools: on hides finished tool rows, off shows them, no argument shows the state',
    usage: 'Usage: /quiet-tools on to hide, /quiet-tools off to show',
    on: 'Quiet tools is on: finished steps are hidden, errors still show. New tool rows draw with the new setting.',
    off: 'Quiet tools is off. New tool rows draw as usual; rows already hidden come back when you reopen this conversation.',
    status: (on: boolean) => `Quiet tools is ${on ? 'on' : 'off'}`,
    unknown: "Didn't understand that argument. ",
    running: '⋯ running',
    runningN: (n: number) => `⋯ running (${n} steps)`,
  },
} as const

export const register: Register = (on, options) => {
  langPref = options?.language ?? 'auto'
  lang = pickLang(langPref, [])

  on('session.start', async ($, e, next) => {
    lang = pickLang(langPref, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
    await $.command.register({ name: 'quiet-tools', description: TEXT[lang].describe })
    return next(e)
  })

  on('command.run', { command: 'quiet-tools' }, async ($, e) => {
    const word = e.args.trim().toLowerCase()
    const t = TEXT[lang]
    if (word === 'on') {
      await $.store.set(ENABLED_KEY, true)
      return { text: t.on }
    }
    if (word === 'off') {
      await $.store.set(ENABLED_KEY, false)
      return { text: t.off }
    }
    if (word === '') {
      const enabled = await $.store.get(ENABLED_KEY)
      return { text: `${t.status(enabled !== false)}\n${t.usage}` }
    }
    return { text: `${t.unknown}${t.usage}` }
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if ((await $.store.get(ENABLED_KEY)) === false) return next(e)
    if (e.props.isExpanded === true) return next(e)
    if (e.props.isErrored || e.props.isInterrupted) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    if (e.props.isRunning) return <Text dimColor>{TEXT[lang].running}</Text>
    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if ((await $.store.get(ENABLED_KEY)) === false) return next(e)
    if (e.props.isExpanded) return next(e)
    // Only an explicit false (mixed content) goes back to the engine; a missing flag falls through to the per-call checks.
    if (e.props.isCallsOnly === false) return next(e)
    if (e.props.calls.some(call => call.isErrored || call.isInterrupted)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    if (e.props.isActive || e.props.calls.some(call => call.isRunning)) {
      return <Text dimColor>{TEXT[lang].runningN(e.props.calls.length)}</Text>
    }
    return <Box />
  })
}
