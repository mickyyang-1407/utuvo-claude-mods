import type { EngineInterface, Register } from 'claude-code'

import { isLineKey, lineInfo, lookFor, paletteFor, pickLine, SCENE_PREFIX, sceneFor } from './palette.js'
import type { LineKey } from './palette.js'
import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

// Session colors / 依色塊換主題: the color block at the start of a session title (🟥🟧🟨🟩🟦🟪🟫⬛⬜🔳🟢🔷🔶🔹🏢🪐)
// picks a whole theme plus a night-sky backdrop. A title with 🔥 (working) adds a slowly breathing glow.
// The title is read from the desktop app's session file:
// ~/Library/Application Support/Claude/claude-code-sessions/*/*/<session id>.json

const SESSIONS_DIR = '/Library/Application Support/Claude/claude-code-sessions'

// this session's state (module variables start over on a reload)
let sessionFile: string | undefined
let shownKey: string | undefined
let shownLine: LineKey | undefined
let checking = false
let lang: Lang = 'en'
const say = (zh: string, en: string): string => (lang === 'zh' ? zh : en)

function currentLine(): LineKey | undefined {
  return shownLine
}

async function findSessionFile($: EngineInterface): Promise<string | undefined> {
  if (sessionFile !== undefined) return sessionFile
  const id = await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')
  const home = await $.env.get('HOME')
  if (id === undefined || id === '' || home === undefined) return undefined
  const root = home + SESSIONS_DIR
  if (!(await $.fs.exists(root))) return undefined
  for (const a of await $.fs.list(root)) {
    if (a.kind !== 'dir') continue
    for (const b of await $.fs.list(`${root}/${a.name}`)) {
      if (b.kind !== 'dir') continue
      const path = `${root}/${a.name}/${b.name}/${id}.json`
      if (await $.fs.exists(path)) {
        sessionFile = path
        return path
      }
    }
  }
  return undefined
}

async function sync($: EngineInterface): Promise<void> {
  if (checking || (await $.store.get('off')) === true) return
  checking = true
  try {
    const file = await findSessionFile($)
    if (file === undefined) return
    const meta = JSON.parse(await $.fs.read(file)) as { title?: unknown }
    const title = typeof meta.title === 'string' ? meta.title : ''
    const line = pickLine(title)
    const live = title.includes('🔥')
    const key = `${line}|${live ? 'live' : 'idle'}`
    if (key === shownKey) return
    const set = await $.theme.set(lookFor(line, live))
    if (!set.isDrawn) $.ui.status(set.reason)
    shownKey = key
    shownLine = line
  } catch {
    // unreadable or malformed: change nothing now, try again next round
  } finally {
    checking = false
  }
}

function describe(line: LineKey): string {
  const info = lineInfo(line)
  return info.emoji === '' ? say('沒有色塊（深藍星空）', 'no color block (deep-blue sky)') : say(`${info.emoji}（${info.label}）`, `${info.emoji} (${info.en})`)
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    lang = pickLang(options?.language, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
    await $.command.register({ name: 'session-colors', description: say('依色塊換主題＋星空：off 關掉、on 打開', 'Theme and night sky by title color block: off, on') })
    const bad = paletteFor('default').problems.find(p => p.startsWith("Desktop won't paint"))
    if (bad !== undefined) $.ui.toast(bad)
    shownKey = undefined
    shownLine = undefined
    await sync($)
    // titles change mid-turn (🔥 added, block swapped): look every 10 s
    $.clock.every(10_000, () => sync($))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await sync($)
    return next(e)
  })

  on('command.run', { command: 'session-colors' }, async ($, e) => {
    if (e.args.trim().toLowerCase() === 'off') {
      await $.store.set('off', true)
      if (shownKey !== undefined) await $.theme.clear()
      shownKey = undefined
      shownLine = undefined
      return { text: say('依色塊上色已關掉（所有 session），/session-colors on 打開。', 'Session colors are off (every session). /session-colors on turns them back on.') }
    }
    await $.store.set('off', false)
    shownKey = undefined
    await sync($)
    const now = currentLine()
    const what = now === undefined ? say('讀不到這個 session 的標題', "can't read this session's title") : describe(now)
    return { text: say(`依色塊上色已打開：${what}。`, `Session colors are on: ${what}.`) }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== $.plugin.name) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const scene = e.props.scene
    if (typeof scene !== 'string' || !scene.startsWith(SCENE_PREFIX)) return next(e)
    const rest = scene.slice(SCENE_PREFIX.length)
    const live = rest.endsWith('-live')
    const line = live ? rest.slice(0, -'-live'.length) : rest
    if (!isLineKey(line)) return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg source={sceneFor(line, live)} alt="A night sky with five bright stars gently twinkling" isInteractive />
  })
}
