import type { EngineInterface, Register } from 'claude-code'

import { buildBoard, SESSION_FILE } from './board'
import type { Board, Entry } from './board'
import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

const ENABLED_KEY = 'enabled'
let lang: Lang = 'en'
const say = (zh: string, en: string): string => (lang === 'zh' ? zh : en)
let langPref: unknown
let langSet = false

// Language is read once, at session.start or the first draw / command (a reload may skip session.start).
async function ensureLang($: EngineInterface): Promise<void> {
  if (langSet) return
  // A fixed choice needs no environment read.
  if (langPref === 'zh-TW' || langPref === 'en') {
    lang = pickLang(langPref, [])
    langSet = true
    return
  }
  lang = pickLang(langPref, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
  langSet = true
}
const usage = (): string => say('用法：/session-board on 開啟，/session-board off 關閉', 'Usage: /session-board on to show it, /session-board off to hide it')
const BOARD = { plugin: 'utuvo-session-board', key: 'board' } as const
const IS_ON = { plugin: 'utuvo-session-board', key: 'isOn' } as const

function parseEntry(text: string): Entry | undefined {
  try {
    const raw: unknown = JSON.parse(text)

    if (typeof raw !== 'object' || raw === null) {
      return undefined
    }

    const data = raw as Record<string, unknown>

    if (typeof data.sessionId !== 'string' || typeof data.status !== 'string' || typeof data.kind !== 'string') {
      return undefined
    }

    return {
      sessionId: data.sessionId,
      name: typeof data.name === 'string' ? data.name : undefined,
      status: data.status,
      statusUpdatedAt: typeof data.statusUpdatedAt === 'number' ? data.statusUpdatedAt : Number.NaN,
      kind: data.kind,
    }
  } catch {
    return undefined
  }
}

export const register: Register = (on, options) => {
  langPref = options?.language
  langSet = false
  let last = ''
  // Set by session.start; lets `/session-board on` redraw at once.
  let runRefresh: (() => Promise<void>) | undefined

  on('session.start', async ($, e, next) => {
    await ensureLang($)
    await $.command.register({
      name: 'session-board',
      description: say('執行中 Session 看板：on 開、off 關、不加參數看狀態', 'Running sessions band: on, off, or no argument for its state'),
    })

    const stored = await $.store.get(ENABLED_KEY)
    await $.state.set(IS_ON, stored !== false)

    const home = await $.env.get('HOME')
    const dir = `${home ?? ''}/.claude/sessions`
    // (an empty or missing HOME is handled in refresh)
    const selfId = await $.session.id()

    const refresh = async (): Promise<void> => {
      // No home folder, or the board is off: do nothing at all (no reads, no state change).
      if (home === undefined || home === '') {
        return
      }

      try {
        if ((await $.store.get(ENABLED_KEY)) === false) {
          return
        }

        const files = await $.fs.list(dir)
        const entries: Entry[] = []

        // Only `<digits>.json` files are read; key files and everything else are never opened.
        for (const file of files) {
          if (!SESSION_FILE.test(file.name) || file.kind !== 'file' || file.isLink === true) {
            continue
          }

          try {
            const entry = parseEntry(await $.fs.read(`${dir}/${file.name}`))

            if (entry !== undefined) {
              entries.push(entry)
            }
          } catch {
            // Unreadable this round: skip it.
          }
        }

        const board = buildBoard(entries, await $.clock.now(), selfId, lang)
        const serialized = JSON.stringify(board)

        if (serialized !== last) {
          last = serialized
          await $.state.set(BOARD, board)
        }
      } catch {
        // Folder missing or unreadable: keep the last board.
      }
    }

    runRefresh = refresh
    await refresh()
    $.clock.every(5000, refresh)

    return next(e)
  })

  on('command.run', { command: 'session-board' }, async ($, e) => {
    await ensureLang($)
    const word = e.args.trim().toLowerCase()

    if (word === 'on') {
      await $.store.set(ENABLED_KEY, true)
      await $.state.set(IS_ON, true)
      await runRefresh?.()

      return { text: say('已開啟「執行中 Session 看板」。', 'The running-sessions band is on.') }
    }

    if (word === 'off') {
      await $.store.set(ENABLED_KEY, false)
      await $.state.set(IS_ON, false)

      return { text: say('已關閉「執行中 Session 看板」。要再打開請輸入 /session-board on', 'The running-sessions band is off. /session-board on brings it back.') }
    }

    if (word === '') {
      const enabled = await $.store.get(ENABLED_KEY)

      return { text: say(`「執行中 Session 看板」目前：${enabled === false ? '關閉' : '開啟'}`, `Running-sessions band: ${enabled === false ? 'off' : 'on'}`) + `\n${usage()}` }
    }

    return { text: say('看不懂這個參數。', 'Unknown argument. ') + usage() }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await ensureLang($)
    const isOn = await $.state.get(IS_ON)

    // Yield the row to the survey; also stay out of the way when switched off.
    if (e.props.hasSurvey || isOn.value === false) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const held = await $.state.get(BOARD)
    const board: Board | null | undefined = held.value

    if (board === null || board === undefined) {
      return (
        <Box flexDirection="column">
          <Text>{say('讀取中…', 'Loading…')}</Text>
        </Box>
      )
    }

    const head =
      board.busyCount > 0
        ? say(`⏳ 正在執行 ${board.busyCount} 個 Session（另有 ${board.idleCount} 個閒置）`, `⏳ ${board.busyCount} sessions running (${board.idleCount} idle)`)
        : say(`✅ 目前沒有 Session 在執行（${board.idleCount} 個閒置）`, `✅ No session is running (${board.idleCount} idle)`)

    return (
      <Box flexDirection="column">
        <Text bold>{head}</Text>
        {board.lines.map((line, index) => (
          <Text key={String(index)}>{line}</Text>
        ))}
        {board.more > 0 ? <Text dimColor>{say(`…還有 ${board.more} 個`, `…and ${board.more} more`)}</Text> : null}
      </Box>
    )
  })
}
