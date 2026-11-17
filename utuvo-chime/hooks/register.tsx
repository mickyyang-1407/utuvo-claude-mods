import type { EngineInterface, Register } from 'claude-code'

import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

// Two chimes / 兩種提示音:
// - a turn that ran 20 s or longer finishes → sounds/done.wav（做完了）
// - the turn ends on a question, or a permission / question prompt opens → sounds/waiting.wav（在等你）
// /chime off | on | test

const MIN_MS = 20_000
let wantsAnswer = false
let lastPlay = 0

const TEXT = {
  zh: {
    desc: '完成／等你提示音：off 關、on 開、test 試聽',
    off: '提示音已關掉（所有 session）。/chime on 打開。',
    test: '剛剛先播「做完了」、再播「在等你」。',
    on: '提示音已打開：做完（超過 20 秒的回合）一聲、在等你回答另一聲。/chime test 試聽。',
  },
  en: {
    desc: 'Done / waiting chimes: off, on, test',
    off: 'Chimes are off (every session). /chime on turns them back on.',
    test: 'Played "done", then "waiting for you".',
    on: 'Chimes are on: one for a finished turn (20 s or longer), another when Claude waits for your answer. /chime test plays both.',
  },
} as const

async function play($: EngineInterface, kind: 'done' | 'waiting'): Promise<void> {
  if ((await $.store.get('off')) === true) return
  const now = await $.clock.now()
  if (now - lastPlay < 4_000) return
  lastPlay = now
  await $.audio.play({ asset: `sounds/${kind}.wav` }).catch(() => {})
}

// The reply ends on a question → Claude is waiting for you.
export function endsWithQuestion(text: string): boolean {
  const tail = text.trim().replace(/[\s*_`)）」』]+$/u, '')
  return /[?？]$/u.test(tail)
}

export const register: Register = (on, options) => {
  let lang: Lang = 'en'

  on('session.start', async ($, e, next) => {
    lang = pickLang(options?.language, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
    await $.command.register({ name: 'chime', description: TEXT[lang].desc })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    wantsAnswer = false
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'AskUserQuestion') {
      void play($, 'waiting')
    } else if (e.tool === 'mcp__ccd_turn__wrap_up') {
      const ask = (e as { ask?: unknown }).ask
      if (typeof ask === 'string' && ask.trim() !== '') wantsAnswer = true
    }
    return next(e)
  })

  on('classic.Notification', async ($, e, next) => {
    if (/permission|idle|elicitation/i.test(e.notification_type)) void play($, 'waiting')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined || e.isAborted) return r
    const waiting = wantsAnswer || endsWithQuestion(e.answer)
    wantsAnswer = false
    if (waiting || e.durationMs >= MIN_MS) void play($, waiting ? 'waiting' : 'done')
    return r
  })

  on('command.run', { command: 'chime' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const t = TEXT[lang]
    if (arg === 'off') {
      await $.store.set('off', true)
      return { text: t.off }
    }
    if (arg === 'test') {
      lastPlay = 0
      await $.audio.play({ asset: 'sounds/done.wav' })
      await $.clock.sleep(600)
      await $.audio.play({ asset: 'sounds/waiting.wav' })
      return { text: t.test }
    }
    await $.store.set('off', false)
    return { text: t.on }
  })
}
